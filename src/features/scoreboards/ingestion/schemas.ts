import { z } from 'zod';

import {
  contestStageSchema,
  problemResultSchema,
  seasonYearSchema,
  slugSchema,
} from '../model/schemas';

const httpsUrlSchema = z.url({ protocol: /^https$/ });
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const identifierSchema = z.string().regex(/^[a-z0-9][a-z0-9._:-]*$/);

export const sourceDefinitionSchema = z
  .object({
    id: slugSchema,
    authorityId: slugSchema,
    name: z.string().min(1),
    baseUrl: httpsUrlSchema,
    allowedOrigins: z
      .array(
        z
          .url({ protocol: /^https$/ })
          .refine(
            (value) => new URL(value).pathname === '/',
            'allowed origins must be origin roots',
          ),
      )
      .optional(),
    supportedStages: z.array(contestStageSchema),
    supportsSeasonStanding: z.boolean(),
  })
  .refine(
    (source) => source.supportedStages.length > 0 || source.supportsSeasonStanding,
    'source must support at least one contest stage or accumulated standings',
  );

const sourcePreferenceSchema = z.object({
  stage: contestStageSchema,
  sourceIds: z.array(slugSchema).min(1),
});

const sourceOverrideSchema = z.object({
  seasonYear: seasonYearSchema,
  seriesId: slugSchema,
  stage: contestStageSchema,
  sourceIds: z.array(slugSchema).min(1),
});

const editionMappingSchema = z.object({
  sourceId: slugSchema,
  editionLabel: z.string().min(1),
  seasonYear: seasonYearSchema,
});

const seasonStandingOverrideSchema = z.object({
  seasonYear: seasonYearSchema,
  seriesId: slugSchema,
  sourceIds: z.array(slugSchema).min(1),
});

const isValidPlaceRanking = (places: readonly number[]): boolean => {
  const sorted = [...places].sort((a, b) => a - b);
  let expected = 1;
  let index = 0;
  while (index < sorted.length) {
    if (sorted[index] !== expected) {
      return false;
    }
    let tied = 0;
    while (index < sorted.length && sorted[index] === expected) {
      tied += 1;
      index += 1;
    }
    expected += tied;
  }
  return true;
};

export const sourceConfigurationSchema = z
  .object({
    schemaVersion: z.literal(1),
    sources: z.array(sourceDefinitionSchema).min(1),
    preferredSources: z.array(sourcePreferenceSchema),
    overrides: z.array(sourceOverrideSchema),
    preferredSeasonStandingSources: z.array(slugSchema),
    seasonStandingOverrides: z.array(seasonStandingOverrideSchema),
    editionMappings: z.array(editionMappingSchema),
  })
  .superRefine((configuration, ctx) => {
    const sources = new Map<string, (typeof configuration.sources)[number]>();
    configuration.sources.forEach((source, index) => {
      if (sources.has(source.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['sources', index, 'id'],
          message: `duplicate source id \`${source.id}\``,
        });
      }
      sources.set(source.id, source);
    });

    const validateSourceIds = (
      sourceIds: readonly string[],
      path: (string | number)[],
      stage: z.infer<typeof contestStageSchema>,
    ) => {
      sourceIds.forEach((sourceId, index) => {
        const source = sources.get(sourceId);
        if (source === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: [...path, index],
            message: `unknown source \`${sourceId}\``,
          });
          return;
        }
        if (!source.supportedStages.includes(stage)) {
          ctx.addIssue({
            code: 'custom',
            path: [...path, index],
            message: `source \`${sourceId}\` does not support stage \`${stage}\``,
          });
        }
      });
    };

    configuration.preferredSources.forEach((rule, index) => {
      if (new Set(rule.sourceIds).size !== rule.sourceIds.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['preferredSources', index, 'sourceIds'],
          message: 'source priorities cannot repeat a source',
        });
      }
      validateSourceIds(rule.sourceIds, ['preferredSources', index, 'sourceIds'], rule.stage);
    });
    configuration.overrides.forEach((rule, index) => {
      if (new Set(rule.sourceIds).size !== rule.sourceIds.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['overrides', index, 'sourceIds'],
          message: 'source priorities cannot repeat a source',
        });
      }
      validateSourceIds(rule.sourceIds, ['overrides', index, 'sourceIds'], rule.stage);
      const duplicates = configuration.overrides
        .slice(0, index)
        .some(
          (previous) =>
            previous.seasonYear === rule.seasonYear &&
            previous.seriesId === rule.seriesId &&
            previous.stage === rule.stage,
        );
      if (duplicates) {
        ctx.addIssue({
          code: 'custom',
          path: ['overrides', index],
          message: 'duplicate edition-specific source override',
        });
      }
    });

    if (
      new Set(configuration.preferredSeasonStandingSources).size !==
      configuration.preferredSeasonStandingSources.length
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['preferredSeasonStandingSources'],
        message: 'source priorities cannot repeat a source',
      });
    }
    configuration.preferredSeasonStandingSources.forEach((sourceId, index) => {
      const source = sources.get(sourceId);
      if (source === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['preferredSeasonStandingSources', index],
          message: `unknown source \`${sourceId}\``,
        });
      } else if (!source.supportsSeasonStanding) {
        ctx.addIssue({
          code: 'custom',
          path: ['preferredSeasonStandingSources', index],
          message: `source \`${sourceId}\` does not support accumulated standings`,
        });
      }
    });
    configuration.seasonStandingOverrides.forEach((rule, index) => {
      if (new Set(rule.sourceIds).size !== rule.sourceIds.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['seasonStandingOverrides', index, 'sourceIds'],
          message: 'source priorities cannot repeat a source',
        });
      }
      rule.sourceIds.forEach((sourceId, sourceIndex) => {
        const source = sources.get(sourceId);
        if (source === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['seasonStandingOverrides', index, 'sourceIds', sourceIndex],
            message: `unknown source \`${sourceId}\``,
          });
        } else if (!source.supportsSeasonStanding) {
          ctx.addIssue({
            code: 'custom',
            path: ['seasonStandingOverrides', index, 'sourceIds', sourceIndex],
            message: `source \`${sourceId}\` does not support accumulated standings`,
          });
        }
      });
      const duplicate = configuration.seasonStandingOverrides
        .slice(0, index)
        .some(
          (previous) =>
            previous.seasonYear === rule.seasonYear && previous.seriesId === rule.seriesId,
        );
      if (duplicate) {
        ctx.addIssue({
          code: 'custom',
          path: ['seasonStandingOverrides', index],
          message: 'duplicate accumulated-standing source override',
        });
      }
    });

    const seenMappings = new Set<string>();
    configuration.editionMappings.forEach((mapping, index) => {
      if (!sources.has(mapping.sourceId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['editionMappings', index, 'sourceId'],
          message: `unknown source \`${mapping.sourceId}\``,
        });
      }
      const key = `${mapping.sourceId}/${mapping.editionLabel}`;
      if (seenMappings.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['editionMappings', index],
          message: `duplicate edition mapping \`${key}\``,
        });
      }
      seenMappings.add(key);
    });
  });

const contestKeySchema = z.object({
  seasonYear: seasonYearSchema,
  seriesId: slugSchema,
  stage: contestStageSchema,
});

export const candidateEvidenceSchema = z.object({
  field: z.string().regex(/^(contest|rows\[\d+\])\.[a-zA-Z][a-zA-Z0-9.]*$/),
  kind: z.enum(['html-cell', 'pdf-text', 'ocr', 'manual']),
  locator: z.string().min(1),
  page: z.number().int().positive().nullable(),
  excerpt: z.string().min(1),
  confidence: z.number().min(0).max(1).nullable(),
});

const candidateTotalsSchema = z.object({
  solved: z.number().int().nonnegative(),
  penalty: z.number().int().nonnegative().nullable(),
});

const candidateRowSchema = z
  .object({
    place: z.number().int().positive(),
    sourceTeamId: z.string().min(1).nullable(),
    teamName: z.string().min(1),
    sourceSchoolId: z.string().min(1).nullable(),
    schoolName: z.string().min(1).nullable(),
    results: z.array(problemResultSchema).nullable(),
    publishedTotals: candidateTotalsSchema.nullable(),
    evidence: z.array(candidateEvidenceSchema).min(1),
  })
  .superRefine((row, ctx) => {
    if (row.results === null && row.publishedTotals === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['publishedTotals'],
        message: 'totals-only candidates require published totals',
      });
    }
  });

export const standingsCandidateSchema = z
  .object({
    candidateId: identifierSchema,
    sourceId: slugSchema,
    authorityId: slugSchema,
    discoveryUrl: httpsUrlSchema,
    finalUrl: httpsUrlSchema,
    retrievedAt: z.iso.datetime({ offset: true }),
    contentSha256: sha256Schema,
    parserVersion: z.string().min(1),
    promptVersion: z.string().min(1).nullable(),
    model: z.string().min(1).nullable(),
    sourceEditionLabel: z.string().min(1),
    contest: contestKeySchema.extend({
      name: z.string().min(1),
      publicationState: z.enum(['final', 'provisional', 'live', 'unknown']),
      date: z.iso.date().nullable(),
      durationMinutes: z.number().int().positive().nullable(),
      penaltyMinutesPerFailedAttempt: z.number().int().nonnegative().nullable(),
      problemLabels: z.array(z.string().regex(/^[A-Z][0-9]?$/)),
    }),
    rows: z.array(candidateRowSchema).min(1),
    coverage: z.object({
      expectedRowCount: z.number().int().positive().nullable(),
      rowsComplete: z.boolean(),
      paginationComplete: z.boolean().nullable(),
    }),
    warnings: z.array(z.string().min(1)),
  })
  .superRefine((candidate, ctx) => {
    const seenProblemLabels = new Set<string>();
    candidate.contest.problemLabels.forEach((label, index) => {
      if (seenProblemLabels.has(label)) {
        ctx.addIssue({
          code: 'custom',
          path: ['contest', 'problemLabels', index],
          message: `duplicate problem label \`${label}\``,
        });
      }
      seenProblemLabels.add(label);
    });
    candidate.rows.forEach((row, index) => {
      if (row.results !== null && row.results.length !== candidate.contest.problemLabels.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['rows', index, 'results'],
          message: 'detailed candidate rows must have one result per known problem',
        });
      }
      row.results?.forEach((result, resultIndex) => {
        if (
          result.status === 'solved' &&
          candidate.contest.durationMinutes !== null &&
          result.solvedAtMinute > candidate.contest.durationMinutes
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['rows', index, 'results', resultIndex],
            message: 'solve time exceeds known contest duration',
          });
        }
      });
      if (row.publishedTotals !== null) {
        if (
          row.publishedTotals.solved > candidate.contest.problemLabels.length &&
          candidate.contest.problemLabels.length > 0
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['rows', index, 'publishedTotals', 'solved'],
            message: 'published solved count exceeds the known problem count',
          });
        }
        if (row.results !== null) {
          const solved = row.results.filter((result) => result.status === 'solved').length;
          if (solved !== row.publishedTotals.solved) {
            ctx.addIssue({
              code: 'custom',
              path: ['rows', index, 'publishedTotals', 'solved'],
              message: 'published solved count disagrees with detailed results',
            });
          }
          const penaltyRule = candidate.contest.penaltyMinutesPerFailedAttempt;
          if (penaltyRule !== null) {
            const penalty = row.results.reduce(
              (total, result) =>
                result.status === 'solved'
                  ? total + result.solvedAtMinute + penaltyRule * (result.attempts - 1)
                  : total,
              0,
            );
            if (row.publishedTotals.penalty !== null && row.publishedTotals.penalty !== penalty) {
              ctx.addIssue({
                code: 'custom',
                path: ['rows', index, 'publishedTotals', 'penalty'],
                message: 'published penalty disagrees with detailed results',
              });
            }
          }
        }
      }
    });
    const sourceTeamIds = candidate.rows.flatMap(({ sourceTeamId }) =>
      sourceTeamId === null ? [] : [sourceTeamId],
    );
    if (new Set(sourceTeamIds).size !== sourceTeamIds.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['rows'],
        message: 'source team identities must be unique within a candidate',
      });
    }
    if (!isValidPlaceRanking(candidate.rows.map(({ place }) => place))) {
      ctx.addIssue({
        code: 'custom',
        path: ['rows'],
        message: 'places must use standard competition ranking with ties',
      });
    }
  });

const seasonStandingCandidateRowSchema = z.object({
  place: z.number().int().positive(),
  sourceTeamId: z.string().min(1).nullable(),
  teamName: z.string().min(1),
  schoolName: z.string().min(1).nullable().default(null),
  score: z.number(),
  scoreText: z.string().min(1),
  scoreUnit: z.string().min(1),
  qualificationText: z.string().nullable(),
  qualified: z.boolean().nullable(),
  pageNumber: z.number().int().positive(),
  confidence: z.number().min(0).max(1).nullable(),
  evidence: z.array(candidateEvidenceSchema).min(3),
});

export const seasonStandingCandidateSchema = z
  .object({
    candidateId: identifierSchema,
    sourceId: slugSchema,
    authorityId: slugSchema,
    discoveryUrl: httpsUrlSchema,
    finalUrl: httpsUrlSchema,
    retrievedAt: z.iso.datetime({ offset: true }),
    contentSha256: sha256Schema,
    parserVersion: z.string().min(1),
    sourceEditionLabel: z.string().min(1),
    seasonYear: seasonYearSchema,
    seriesId: slugSchema,
    snapshot: z.enum(['intermediate', 'latest-explicit', 'unconfirmed']),
    scoreUnit: z.string().min(1),
    rows: z.array(seasonStandingCandidateRowSchema).min(1),
    pageNumbers: z.array(z.number().int().positive()).min(1),
    coverage: z.object({
      expectedRowCount: z.number().int().positive().nullable(),
      rowsComplete: z.boolean(),
      pagesComplete: z.boolean(),
    }),
    warnings: z.array(z.string().min(1)),
  })
  .superRefine((candidate, ctx) => {
    if (!isValidPlaceRanking(candidate.rows.map(({ place }) => place))) {
      ctx.addIssue({
        code: 'custom',
        path: ['rows'],
        message: 'places must use standard competition ranking with ties',
      });
    }
    const sourceTeamIds = candidate.rows.flatMap(({ sourceTeamId }) =>
      sourceTeamId === null ? [] : [sourceTeamId],
    );
    if (new Set(sourceTeamIds).size !== sourceTeamIds.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['rows'],
        message: 'source team identities must be unique within a season-standing candidate',
      });
    }
  });

const proposalReferenceSchema = z.object({
  candidateId: identifierSchema,
  rowIndex: z.number().int().nonnegative(),
});

const reviewConflictSchema = z.object({
  contest: contestKeySchema,
  entityId: z.string().min(1),
  field: z.string().min(1),
  kind: z.enum(['archive', 'source', 'validation', 'identity', 'publication-state']),
  currentValue: z.string().nullable(),
  alternatives: z
    .array(
      z.object({
        candidateId: identifierSchema,
        value: z.string().nullable(),
        evidence: z.array(candidateEvidenceSchema),
      }),
    )
    .min(1),
});

const seasonStandingConflictSchema = z.object({
  seasonYear: seasonYearSchema,
  seriesId: slugSchema,
  entityId: z.string().min(1),
  field: z.string().min(1),
  kind: z.enum(['archive', 'identity', 'publication-state', 'source', 'validation']),
  currentValue: z.string().nullable(),
  alternatives: z
    .array(
      z.object({
        candidateId: identifierSchema,
        value: z.string().nullable(),
        evidence: z.array(candidateEvidenceSchema),
      }),
    )
    .min(1),
});

const identityProposalSchema = z.object({
  candidateId: identifierSchema,
  rowIndex: z.number().int().nonnegative(),
  sourceId: slugSchema,
  seasonYear: seasonYearSchema,
  sourceTeamId: z.string().min(1).nullable(),
  teamName: z.string().min(1),
  sourceSchoolId: z.string().min(1).nullable(),
  schoolName: z.string().min(1).nullable(),
});

export const reviewProposalSchema = z
  .object({
    schemaVersion: z.literal(1),
    runId: identifierSchema,
    generatedAt: z.iso.datetime({ offset: true }),
    status: z.enum(['complete', 'partial', 'failed']),
    candidates: z.array(standingsCandidateSchema),
    additions: z.array(proposalReferenceSchema),
    seasonStandingCandidates: z.array(seasonStandingCandidateSchema).default([]),
    seasonStandingAdditions: z.array(proposalReferenceSchema).default([]),
    identityProposals: z.array(identityProposalSchema).default([]),
    conflicts: z.array(reviewConflictSchema),
    seasonStandingConflicts: z.array(seasonStandingConflictSchema).default([]),
    runIssues: z.array(
      z.object({
        kind: z.enum(['candidate', 'configuration', 'identity-registry']),
        message: z.string().min(1),
      }),
    ),
    sourceFailures: z.array(
      z.object({
        sourceId: slugSchema,
        contest: contestKeySchema.nullable(),
        message: z.string().min(1),
      }),
    ),
  })
  .superRefine((proposal, ctx) => {
    const candidateIds = new Set<string>();
    proposal.candidates.forEach((candidate, index) => {
      if (candidateIds.has(candidate.candidateId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['candidates', index, 'candidateId'],
          message: 'duplicate candidate id',
        });
      }
      candidateIds.add(candidate.candidateId);
    });
    proposal.seasonStandingCandidates.forEach((candidate, index) => {
      if (candidateIds.has(candidate.candidateId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['seasonStandingCandidates', index, 'candidateId'],
          message: 'duplicate candidate id',
        });
      }
      candidateIds.add(candidate.candidateId);
    });
    proposal.additions.forEach((addition, index) => {
      const candidate = proposal.candidates.find(
        ({ candidateId }) => candidateId === addition.candidateId,
      );
      if (candidate?.rows[addition.rowIndex] === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['additions', index],
          message: 'addition must reference an existing candidate row',
        });
      } else if (candidate.contest.publicationState !== 'final') {
        ctx.addIssue({
          code: 'custom',
          path: ['additions', index],
          message: 'only final candidates can propose publishable additions',
        });
      }
    });
    proposal.conflicts.forEach((conflict, conflictIndex) => {
      conflict.alternatives.forEach((alternative, alternativeIndex) => {
        if (!candidateIds.has(alternative.candidateId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['conflicts', conflictIndex, 'alternatives', alternativeIndex, 'candidateId'],
            message: 'conflict alternative must reference an existing candidate',
          });
        }
      });
    });
    proposal.seasonStandingAdditions.forEach((addition, index) => {
      const candidate = proposal.seasonStandingCandidates.find(
        ({ candidateId }) => candidateId === addition.candidateId,
      );
      if (candidate?.rows[addition.rowIndex] === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['seasonStandingAdditions', index],
          message: 'addition must reference an existing season-standing candidate row',
        });
      } else if (candidate.snapshot !== 'latest-explicit') {
        ctx.addIssue({
          code: 'custom',
          path: ['seasonStandingAdditions', index],
          message: 'only explicitly final season standings can propose additions',
        });
      }
    });
    proposal.seasonStandingConflicts.forEach((conflict, conflictIndex) => {
      conflict.alternatives.forEach((alternative, alternativeIndex) => {
        if (!candidateIds.has(alternative.candidateId)) {
          ctx.addIssue({
            code: 'custom',
            path: [
              'seasonStandingConflicts',
              conflictIndex,
              'alternatives',
              alternativeIndex,
              'candidateId',
            ],
            message: 'conflict alternative must reference an existing candidate',
          });
        }
      });
    });
    proposal.identityProposals.forEach((identityProposal, index) => {
      const contestCandidate = proposal.candidates.find(
        ({ candidateId }) => candidateId === identityProposal.candidateId,
      );
      const seasonStandingCandidate = proposal.seasonStandingCandidates.find(
        ({ candidateId }) => candidateId === identityProposal.candidateId,
      );
      const contestRow = contestCandidate?.rows[identityProposal.rowIndex];
      const seasonStandingRow = seasonStandingCandidate?.rows[identityProposal.rowIndex];
      if (contestRow === undefined && seasonStandingRow === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['identityProposals', index],
          message: 'identity proposal must reference an existing candidate row',
        });
        return;
      }
      const sourceId = contestCandidate?.sourceId ?? seasonStandingCandidate?.sourceId;
      const seasonYear =
        contestCandidate?.contest.seasonYear ?? seasonStandingCandidate?.seasonYear;
      if (sourceId !== identityProposal.sourceId || seasonYear !== identityProposal.seasonYear) {
        ctx.addIssue({
          code: 'custom',
          path: ['identityProposals', index],
          message: 'identity proposal source and season must match its candidate row',
        });
      }
    });
    if (
      proposal.status === 'failed' &&
      (proposal.additions.length > 0 || proposal.seasonStandingAdditions.length > 0)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['additions'],
        message: 'failed runs cannot propose publishable additions',
      });
    }
    if (proposal.status === 'complete' && proposal.sourceFailures.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['sourceFailures'],
        message: 'a complete run cannot contain source failures',
      });
    }
    if (proposal.status === 'complete' && proposal.runIssues.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['runIssues'],
        message: 'a complete run cannot contain run-level validation issues',
      });
    }
    if (
      proposal.runIssues.length > 0 &&
      (proposal.additions.length > 0 || proposal.seasonStandingAdditions.length > 0)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['additions'],
        message: 'run-level validation issues block all additions',
      });
    }
  });

export const selectPreferredSourceIds = (
  configuration: SourceConfiguration,
  seasonYear: number,
  seriesId: string,
  stage: z.infer<typeof contestStageSchema>,
): string[] => {
  const override = configuration.overrides.find(
    (rule) => rule.seasonYear === seasonYear && rule.seriesId === seriesId && rule.stage === stage,
  );
  if (override !== undefined) {
    return [...override.sourceIds];
  }
  return [
    ...(configuration.preferredSources.find((rule) => rule.stage === stage)?.sourceIds ?? []),
  ];
};

export const mapSourceEdition = (
  configuration: SourceConfiguration,
  sourceId: string,
  editionLabel: string,
): number | undefined =>
  configuration.editionMappings.find(
    (mapping) => mapping.sourceId === sourceId && mapping.editionLabel === editionLabel,
  )?.seasonYear;

export const selectPreferredSeasonStandingSourceIds = (
  configuration: SourceConfiguration,
  seasonYear: number,
  seriesId: string,
): string[] => {
  const override = configuration.seasonStandingOverrides.find(
    (rule) => rule.seasonYear === seasonYear && rule.seriesId === seriesId,
  );
  return override === undefined
    ? [...configuration.preferredSeasonStandingSources]
    : [...override.sourceIds];
};

export const validateCandidateSource = (
  candidate: StandingsCandidate,
  configuration: SourceConfiguration,
): string[] => {
  const source = configuration.sources.find(({ id }) => id === candidate.sourceId);
  if (source === undefined) {
    return [`unknown source \`${candidate.sourceId}\``];
  }
  const issues: string[] = [];
  if (source.authorityId !== candidate.authorityId) {
    issues.push(`authority \`${candidate.authorityId}\` does not match source \`${source.id}\``);
  }
  if (!source.supportedStages.includes(candidate.contest.stage)) {
    issues.push(`source \`${source.id}\` does not support stage \`${candidate.contest.stage}\``);
  }
  const mappedYear = mapSourceEdition(
    configuration,
    candidate.sourceId,
    candidate.sourceEditionLabel,
  );
  if (mappedYear === undefined) {
    issues.push(
      `source edition \`${candidate.sourceEditionLabel}\` has no reviewed season mapping`,
    );
  } else if (mappedYear !== candidate.contest.seasonYear) {
    issues.push(
      `source edition \`${candidate.sourceEditionLabel}\` maps to ${String(mappedYear)}, not ${String(candidate.contest.seasonYear)}`,
    );
  }
  return issues;
};

export type SourceDefinition = z.infer<typeof sourceDefinitionSchema>;
export type SourceConfiguration = z.infer<typeof sourceConfigurationSchema>;
export type CandidateEvidence = z.infer<typeof candidateEvidenceSchema>;
export type StandingsCandidate = z.infer<typeof standingsCandidateSchema>;
export type SeasonStandingCandidate = z.infer<typeof seasonStandingCandidateSchema>;
export type ReviewProposal = z.infer<typeof reviewProposalSchema>;

export const validateSeasonStandingCandidateSource = (
  candidate: SeasonStandingCandidate,
  configuration: SourceConfiguration,
): string[] => {
  const source = configuration.sources.find(({ id }) => id === candidate.sourceId);
  if (source === undefined) {
    return [`unknown source \`${candidate.sourceId}\``];
  }
  const issues: string[] = [];
  if (source.authorityId !== candidate.authorityId) {
    issues.push(`authority \`${candidate.authorityId}\` does not match source \`${source.id}\``);
  }
  if (!source.supportsSeasonStanding) {
    issues.push(`source \`${source.id}\` does not support season standings`);
  }
  const mappedYear = mapSourceEdition(
    configuration,
    candidate.sourceId,
    candidate.sourceEditionLabel,
  );
  if (mappedYear === undefined) {
    issues.push(
      `source edition \`${candidate.sourceEditionLabel}\` has no reviewed season mapping`,
    );
  } else if (mappedYear !== candidate.seasonYear) {
    issues.push(
      `source edition \`${candidate.sourceEditionLabel}\` maps to ${String(mappedYear)}, not ${String(candidate.seasonYear)}`,
    );
  }
  return issues;
};

export const seasonStandingCandidateCoverageIssues = (
  candidate: SeasonStandingCandidate,
): string[] => {
  const issues: string[] = [];
  if (!candidate.coverage.rowsComplete) {
    issues.push('source did not confirm that all season-standing rows were collected');
  }
  if (!candidate.coverage.pagesComplete) {
    issues.push('source document pages are incomplete or unknown');
  }
  if (
    candidate.coverage.expectedRowCount !== null &&
    candidate.coverage.expectedRowCount !== candidate.rows.length
  ) {
    issues.push(
      `expected ${String(candidate.coverage.expectedRowCount)} rows but collected ${String(candidate.rows.length)}`,
    );
  }
  return issues;
};

export const candidateCoverageIssues = (candidate: StandingsCandidate): string[] => {
  const issues: string[] = [];
  if (!candidate.coverage.rowsComplete) {
    issues.push('source did not confirm that all standings rows were collected');
  }
  if (candidate.coverage.paginationComplete !== true) {
    issues.push('source pagination is incomplete or unknown');
  }
  if (
    candidate.coverage.expectedRowCount !== null &&
    candidate.coverage.expectedRowCount !== candidate.rows.length
  ) {
    issues.push(
      `expected ${String(candidate.coverage.expectedRowCount)} rows but collected ${String(candidate.rows.length)}`,
    );
  }
  return issues;
};
