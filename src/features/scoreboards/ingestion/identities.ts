import { z } from 'zod';

import { seasonYearSchema, slugSchema } from '../model/schemas';

const reviewedAlias = {
  sourceId: slugSchema,
  sourceIdentityId: z.string().min(1),
  reviewedBy: z.string().min(1),
  reviewReference: z.string().min(1),
  reviewedAt: z.iso.datetime({ offset: true }),
};

export const reviewedIdentityAliasSchema = z.discriminatedUnion('entityType', [
  z.object({
    ...reviewedAlias,
    entityType: z.literal('school'),
    seasonYear: z.null(),
    canonicalId: slugSchema,
  }),
  z.object({
    ...reviewedAlias,
    entityType: z.literal('team'),
    seasonYear: seasonYearSchema,
    canonicalId: slugSchema,
  }),
]);

export const identityAliasRegistrySchema = z
  .object({
    schemaVersion: z.literal(1),
    aliases: z.array(reviewedIdentityAliasSchema),
  })
  .superRefine((registry, ctx) => {
    const seen = new Set<string>();
    registry.aliases.forEach((alias, index) => {
      const key = `${alias.sourceId}/${alias.entityType}/${String(alias.seasonYear ?? 'all')}/${alias.sourceIdentityId}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['aliases', index, 'sourceIdentityId'],
          message: `duplicate reviewed identity alias \`${key}\``,
        });
      }
      seen.add(key);
    });
  });

export type ReviewedIdentityAlias = z.infer<typeof reviewedIdentityAliasSchema>;

export type IdentityResolution =
  | { status: 'resolved'; canonicalId: string }
  | { status: 'unresolved'; reason: 'missing-alias' | 'ambiguous-alias' };

export const resolveReviewedIdentity = (
  aliases: readonly ReviewedIdentityAlias[],
  identity: {
    sourceId: string;
    entityType: 'school' | 'team';
    sourceIdentityId: string | null;
    seasonYear: number | null;
  },
): IdentityResolution => {
  if (identity.sourceIdentityId === null) {
    return { status: 'unresolved', reason: 'missing-alias' };
  }
  const matches = aliases.filter(
    (alias) =>
      alias.sourceId === identity.sourceId &&
      alias.entityType === identity.entityType &&
      alias.sourceIdentityId === identity.sourceIdentityId &&
      (alias.entityType === 'school' || alias.seasonYear === identity.seasonYear),
  );
  if (matches.length === 0) {
    return { status: 'unresolved', reason: 'missing-alias' };
  }
  if (matches.length > 1) {
    return { status: 'unresolved', reason: 'ambiguous-alias' };
  }
  return { status: 'resolved', canonicalId: matches[0].canonicalId };
};

export const validateIdentityAliasTargets = (
  aliases: readonly ReviewedIdentityAlias[],
  targets: {
    sourceIds: ReadonlySet<string>;
    schoolIds: ReadonlySet<string>;
    teams: readonly { id: string; seasonYear: number }[];
  },
): string[] =>
  aliases.flatMap((alias, index) => {
    const issues: string[] = [];
    if (!targets.sourceIds.has(alias.sourceId)) {
      issues.push(`aliases[${String(index)}] references unknown source \`${alias.sourceId}\``);
    }
    if (alias.entityType === 'school' && !targets.schoolIds.has(alias.canonicalId)) {
      issues.push(`aliases[${String(index)}] references unknown school \`${alias.canonicalId}\``);
    }
    if (
      alias.entityType === 'team' &&
      !targets.teams.some(
        (team) => team.id === alias.canonicalId && team.seasonYear === alias.seasonYear,
      )
    ) {
      issues.push(
        `aliases[${String(index)}] references unknown team \`${alias.canonicalId}\` in season ${String(alias.seasonYear)}`,
      );
    }
    return issues;
  });
