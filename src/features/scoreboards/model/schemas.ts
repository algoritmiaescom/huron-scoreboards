import { z } from 'zod';

import { isValidPlaceRanking } from './ranking';
import { scoreStandingRow } from './scoring';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const slugSchema = z
  .string()
  .regex(SLUG_PATTERN, 'must be a lowercase slug such as `ipn-escom`');

export const seasonYearSchema = z.number().int().min(1990).max(2100);

export const contestStageSchema = z.enum([
  'fecha-0',
  'qualifier-1',
  'qualifier-2',
  'qualifier-3',
  'repechage',
  'final',
]);

/** A logo committed under `public/`, referenced by the path the site serves it from. */
const LOGO_PATH_PATTERN = /^logos\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:svg|png|webp)$/;

/**
 * Only `https` is allowed. The value is rendered as an image source: a plain URL check accepts
 * `javascript:` and `data:`, which community-contributed data must never reach, and `http` would
 * load as mixed content.
 */
const remoteLogoSchema = z.url({ protocol: /^https$/ });

export const isRemoteLogo = (logo: string): boolean => remoteLogoSchema.safeParse(logo).success;

/**
 * A logo is either committed to the repository or hosted by the school. One field keeps the
 * common case — a school has one logo — from needing two mutually exclusive properties.
 */
export const schoolLogoSchema = z
  .string()
  .refine(
    (value) => LOGO_PATH_PATTERN.test(value) || isRemoteLogo(value),
    'must be a file committed under `public/` and referenced as `logos/ipn-escom.svg`, or an absolute https URL',
  );

export const schoolSchema = z.object({
  id: slugSchema,
  officialName: z.string().min(1),
  shortName: z.string().min(1),
  parentInstitutionId: slugSchema.optional(),
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  // Optional: many schools have no logo on file, so every view must render without one.
  logo: schoolLogoSchema.optional(),
});

export const teamMemberSchema = z.object({
  name: z.string().min(1),
  role: z.enum(['contestant', 'coach']).optional(),
});

export const teamSchema = z.object({
  id: slugSchema,
  name: z.string().min(1),
  schoolId: slugSchema.nullable(),
  seasonYear: seasonYearSchema,
  members: z.array(teamMemberSchema).optional(),
});

export const problemSchema = z.object({
  label: z.string().regex(/^[A-Z][0-9]?$/, 'must be a problem label such as `A`'),
  title: z.string().min(1).optional(),
  url: z.url().optional(),
});

/**
 * A discriminated union so that contradictory cells — a solve time without attempts, attempts on
 * an unattempted problem — cannot be represented.
 */
export const problemResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('unattempted') }),
  z.object({
    status: z.literal('attempted'),
    attempts: z.number().int().positive(),
  }),
  z.object({
    status: z.literal('solved'),
    attempts: z.number().int().positive(),
    solvedAtMinute: z.number().int().nonnegative(),
  }),
]);

const publishedTotalsSchema = z.object({
  solved: z.number().int().nonnegative(),
  penalty: z.number().int().nonnegative().nullable(),
});

const standingIdentity = {
  place: z.number().int().positive().nullable(),
  teamId: slugSchema,
};

export const standingRowSchema = z.union([
  z.object({
    ...standingIdentity,
    results: z.array(problemResultSchema),
    publishedTotals: publishedTotalsSchema.optional(),
  }),
  z.object({
    ...standingIdentity,
    results: z.null(),
    publishedTotals: publishedTotalsSchema,
  }),
]);

export const seasonStandingRowSchema = z.object({
  place: z.number().int().positive(),
  teamId: slugSchema,
  score: z.number(),
  qualified: z.boolean().nullable(),
});

const publicationFields = {
  ranking: z.enum(['competition', 'dense', 'published']).optional(),
  publicationNotes: z.array(z.string().min(1)).min(1).optional(),
};

const addPlaceRankingIssue = (
  places: readonly (number | null)[],
  ctx: z.RefinementCtx,
  key: string,
  ranking: 'competition' | 'dense' | 'published' = 'competition',
  notes?: string[],
) => {
  if (ranking === 'published') {
    if (notes === undefined || notes.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['publicationNotes'],
        message: 'as-published rankings require an explanation of missing or irregular places',
      });
    }
    return;
  }
  if (
    places.some((place) => place === null) ||
    !isValidPlaceRanking(
      places.filter((place) => place !== null),
      ranking,
    )
  ) {
    ctx.addIssue({
      code: 'custom',
      path: [key],
      message:
        ranking === 'dense'
          ? 'dense places must start at 1 and advance by one after each distinct place'
          : 'places must start at 1 and skip ahead after a tie, so that 1, 2, 2, 4 is valid but 1, 2, 2, 3 is not',
    });
  }
};

export const contestSchema = z
  .object({
    id: slugSchema,
    seasonYear: seasonYearSchema,
    seriesId: slugSchema,
    stage: contestStageSchema,
    name: z.string().min(1),
    date: z.iso.date().nullable(),
    durationMinutes: z.number().int().positive().nullable(),
    penaltyMinutesPerFailedAttempt: z.number().int().nonnegative().nullable(),
    problems: z.array(problemSchema),
    standings: z.array(standingRowSchema),
    source: z.url(),
    ...publicationFields,
  })
  .superRefine((contest, ctx) => {
    const seenLabels = new Set<string>();

    contest.problems.forEach((problem, index) => {
      if (seenLabels.has(problem.label)) {
        ctx.addIssue({
          code: 'custom',
          path: ['problems', index, 'label'],
          message: `duplicate problem label \`${problem.label}\``,
        });
      }

      seenLabels.add(problem.label);
    });

    const seenTeamIds = new Set<string>();

    contest.standings.forEach((row, rowIndex) => {
      if (seenTeamIds.has(row.teamId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['standings', rowIndex, 'teamId'],
          message: `team \`${row.teamId}\` appears more than once in the standings`,
        });
      }

      seenTeamIds.add(row.teamId);

      if (
        row.publishedTotals !== undefined &&
        contest.problems.length > 0 &&
        row.publishedTotals.solved > contest.problems.length
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['standings', rowIndex, 'publishedTotals', 'solved'],
          message: 'published solved count exceeds the known problem count',
        });
      }

      if (row.results === null) {
        return;
      }

      if (contest.problems.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['problems'],
          message: 'detailed rows require a known nonempty problem set',
        });
      }

      if (row.publishedTotals !== undefined) {
        const computed = scoreStandingRow(row, contest.penaltyMinutesPerFailedAttempt);
        if (row.publishedTotals.solved !== computed.solved) {
          ctx.addIssue({
            code: 'custom',
            path: ['standings', rowIndex, 'publishedTotals', 'solved'],
            message: 'published solved count does not match detailed results',
          });
        }
        if (
          computed.penalty !== null &&
          row.publishedTotals.penalty !== null &&
          computed.penalty !== row.publishedTotals.penalty
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['standings', rowIndex, 'publishedTotals', 'penalty'],
            message: 'published penalty does not match detailed results',
          });
        }
      }

      if (row.results.length !== contest.problems.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['standings', rowIndex, 'results'],
          message: `expected one result per problem (${String(contest.problems.length)}), received ${String(row.results.length)}`,
        });
      }

      row.results.forEach((result, resultIndex) => {
        if (
          result.status === 'solved' &&
          contest.durationMinutes !== null &&
          result.solvedAtMinute > contest.durationMinutes
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['standings', rowIndex, 'results', resultIndex, 'solvedAtMinute'],
            message: `solved at minute ${String(result.solvedAtMinute)}, after the contest ended at minute ${String(contest.durationMinutes)}`,
          });
        }
      });
    });

    addPlaceRankingIssue(
      contest.standings.map((row) => row.place),
      ctx,
      'standings',
      contest.ranking,
      contest.publicationNotes,
    );
  });

export const seasonStandingSchema = z
  .object({
    seasonYear: seasonYearSchema,
    seriesId: slugSchema,
    rows: z.array(seasonStandingRowSchema),
    source: z.url(),
    scoreUnit: z.string().min(1).optional(),
    snapshot: z.enum(['intermediate', 'latest-explicit', 'unconfirmed']).optional(),
    snapshotLabel: z.string().min(1).optional(),
    ...publicationFields,
  })
  .superRefine((standing, ctx) => {
    if (
      standing.snapshot !== undefined &&
      standing.snapshot !== 'latest-explicit' &&
      standing.snapshotLabel === undefined
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['snapshotLabel'],
        message: 'non-final season standings must describe the published snapshot',
      });
    }
    if (standing.snapshotLabel !== undefined && standing.snapshot === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['snapshot'],
        message: 'snapshot labels require an explicit snapshot status',
      });
    }
    const seenTeamIds = new Set<string>();

    standing.rows.forEach((row, index) => {
      if (seenTeamIds.has(row.teamId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['rows', index, 'teamId'],
          message: `team \`${row.teamId}\` appears more than once in the standing`,
        });
      }

      seenTeamIds.add(row.teamId);
    });

    addPlaceRankingIssue(
      standing.rows.map((row) => row.place),
      ctx,
      'rows',
      standing.ranking,
      standing.publicationNotes,
    );
  });

export const schoolsFileSchema = z.array(schoolSchema);
export const teamsFileSchema = z.array(teamSchema);

export type School = z.infer<typeof schoolSchema>;
export type Team = z.infer<typeof teamSchema>;
export type TeamMember = z.infer<typeof teamMemberSchema>;
export type Problem = z.infer<typeof problemSchema>;
export type ProblemResult = z.infer<typeof problemResultSchema>;
export type StandingRow = z.infer<typeof standingRowSchema>;
export type Contest = z.infer<typeof contestSchema>;
export type SeasonStanding = z.infer<typeof seasonStandingSchema>;
export type ContestStage = z.infer<typeof contestStageSchema>;
