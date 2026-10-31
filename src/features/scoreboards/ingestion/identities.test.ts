import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  identityAliasRegistrySchema,
  resolveReviewedIdentity,
  type ReviewedIdentityAlias,
  validateIdentityAliasTargets,
} from './identities';

const aliases: ReviewedIdentityAlias[] = [
  {
    entityType: 'school',
    sourceId: 'icpc-mexico',
    sourceIdentityId: 'school-42',
    seasonYear: null,
    canonicalId: 'ipn-escom',
    reviewedBy: 'maintainer',
    reviewReference: 'https://github.com/example/repo/pull/42',
    reviewedAt: '2026-10-28T12:00:00Z',
  },
  {
    entityType: 'team',
    sourceId: 'icpc-mexico',
    sourceIdentityId: 'team-42',
    seasonYear: 2024,
    canonicalId: '2024-alpha',
    reviewedBy: 'maintainer',
    reviewReference: 'https://github.com/example/repo/pull/42',
    reviewedAt: '2026-10-28T12:00:00Z',
  },
];

describe('reviewed source identity aliases', () => {
  it('validates the committed registry without inventing seed aliases', () => {
    const config = JSON.parse(readFileSync('config/standings-identities.json', 'utf8')) as unknown;
    expect(identityAliasRegistrySchema.parse(config)).toEqual({ schemaVersion: 1, aliases: [] });
  });

  it('requires review provenance and season scope for team aliases', () => {
    expect(identityAliasRegistrySchema.parse({ schemaVersion: 1, aliases })).toEqual({
      schemaVersion: 1,
      aliases,
    });
    expect(
      identityAliasRegistrySchema.safeParse({
        schemaVersion: 1,
        aliases: [{ ...aliases[1], reviewedBy: '' }],
      }).success,
    ).toBe(false);
    expect(
      identityAliasRegistrySchema.safeParse({
        schemaVersion: 1,
        aliases: [{ ...aliases[1], seasonYear: null }],
      }).success,
    ).toBe(false);
  });

  it('rejects duplicate aliases for a source identity and scope', () => {
    expect(
      identityAliasRegistrySchema.safeParse({
        schemaVersion: 1,
        aliases: [aliases[0], aliases[0]],
      }).success,
    ).toBe(false);
  });

  it('resolves only exact reviewed source ids, never display-name similarity', () => {
    expect(
      resolveReviewedIdentity(aliases, {
        sourceId: 'icpc-mexico',
        entityType: 'school',
        sourceIdentityId: 'school-42',
        seasonYear: null,
      }),
    ).toEqual({ status: 'resolved', canonicalId: 'ipn-escom' });
    expect(
      resolveReviewedIdentity(aliases, {
        sourceId: 'icpc-mexico',
        entityType: 'team',
        sourceIdentityId: 'team-42',
        seasonYear: 2025,
      }),
    ).toEqual({ status: 'unresolved', reason: 'missing-alias' });
    expect(
      resolveReviewedIdentity(aliases, {
        sourceId: 'icpc-global-finder',
        entityType: 'school',
        sourceIdentityId: 'school-42',
        seasonYear: null,
      }),
    ).toEqual({ status: 'unresolved', reason: 'missing-alias' });
    expect(
      resolveReviewedIdentity(aliases, {
        sourceId: 'icpc-mexico',
        entityType: 'school',
        sourceIdentityId: null,
        seasonYear: null,
      }),
    ).toEqual({ status: 'unresolved', reason: 'missing-alias' });
  });

  it('validates aliases against registered sources and season-scoped archive identities', () => {
    expect(
      validateIdentityAliasTargets(aliases, {
        sourceIds: new Set(['icpc-mexico']),
        schoolIds: new Set(['ipn-escom']),
        teams: [{ id: '2024-alpha', seasonYear: 2024 }],
      }),
    ).toEqual([]);
    expect(
      validateIdentityAliasTargets(aliases, {
        sourceIds: new Set(),
        schoolIds: new Set(),
        teams: [],
      }),
    ).toEqual([
      'aliases[0] references unknown source `icpc-mexico`',
      'aliases[0] references unknown school `ipn-escom`',
      'aliases[1] references unknown source `icpc-mexico`',
      'aliases[1] references unknown team `2024-alpha` in season 2024',
    ]);
  });
});
