import { z } from 'zod';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const slugSchema = z
  .string()
  .regex(SLUG_PATTERN, 'must be a lowercase slug such as `ipn-escom`');

export const seasonYearSchema = z.number().int().min(1990).max(2100);

export const contestStageSchema = z.enum([
  'qualifier-1',
  'qualifier-2',
  'qualifier-3',
  'repechage',
  'final',
]);

/** A logo committed under `public/`, referenced by the path the site serves it from. */
const LOGO_PATH_PATTERN = /^logos\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:svg|png|webp)$/;

/**
 * Only `http` and `https` are allowed. The value is rendered as an image source, and a plain URL
 * check accepts `javascript:` and `data:`, which community-contributed data must never reach.
 */
const remoteLogoSchema = z.url({ protocol: /^https?$/ });

export const isRemoteLogo = (logo: string): boolean => remoteLogoSchema.safeParse(logo).success;

/**
 * A logo is either committed to the repository or hosted by the school. One field keeps the
 * common case — a school has one logo — from needing two mutually exclusive properties.
 */
export const schoolLogoSchema = z
  .string()
  .refine(
    (value) => LOGO_PATH_PATTERN.test(value) || isRemoteLogo(value),
    'must be a file committed under `public/` and referenced as `logos/ipn-escom.svg`, or an absolute http(s) URL',
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
  schoolId: slugSchema,
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

export const standingRowSchema = z.object({
  place: z.number().int().positive(),
  teamId: slugSchema,
  results: z.array(problemResultSchema),
});

export const seasonStandingRowSchema = z.object({
  place: z.number().int().positive(),
  teamId: slugSchema,
  score: z.number(),
  qualified: z.boolean(),
});

/**
 * Standard competition ranking: places start at 1, ties share a place, and the place after a tie
 * of `n` teams skips ahead by `n`.
 */
const isValidPlaceRanking = (places: readonly number[]): boolean => {
  const sorted = [...places].sort((a, b) => a - b);
  let expected = 1;
  let index = 0;

  while (index < sorted.length) {
    const place = sorted[index];

    if (place !== expected) {
      return false;
    }

    let tied = 0;
    while (index < sorted.length && sorted[index] === place) {
      tied += 1;
      index += 1;
    }

    expected += tied;
  }

  return true;
};

const addPlaceRankingIssue = (places: readonly number[], ctx: z.RefinementCtx, key: string) => {
  if (!isValidPlaceRanking(places)) {
    ctx.addIssue({
      code: 'custom',
      path: [key],
      message:
        'places must start at 1 and skip ahead after a tie, so that 1, 2, 2, 4 is valid but 1, 2, 2, 3 is not',
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
    date: z.iso.date(),
    durationMinutes: z.number().int().positive(),
    penaltyMinutesPerFailedAttempt: z.number().int().nonnegative(),
    problems: z.array(problemSchema).min(1),
    standings: z.array(standingRowSchema),
    source: z.url(),
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

      if (row.results.length !== contest.problems.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['standings', rowIndex, 'results'],
          message: `expected one result per problem (${String(contest.problems.length)}), received ${String(row.results.length)}`,
        });
      }

      row.results.forEach((result, resultIndex) => {
        if (result.status === 'solved' && result.solvedAtMinute > contest.durationMinutes) {
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
    );
  });

export const seasonStandingSchema = z
  .object({
    seasonYear: seasonYearSchema,
    seriesId: slugSchema,
    rows: z.array(seasonStandingRowSchema),
    source: z.url(),
  })
  .superRefine((standing, ctx) => {
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
