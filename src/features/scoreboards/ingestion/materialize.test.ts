import { describe, expect, it } from 'vitest';

import { archive } from '@/test/fixtures/archive';

import { materializeProposal } from './materialize';
import {
  reviewProposalSchema,
  seasonStandingCandidateSchema,
  standingsCandidateSchema,
} from './schemas';

import type { ReviewedIdentityAlias } from './identities';

const configuration = {
  schemaVersion: 1,
  sources: [
    {
      id: 'fixture',
      authorityId: 'fixture',
      name: 'Fixture',
      baseUrl: 'https://example.com',
      supportedStages: ['qualifier-2'],
      supportsSeasonStanding: true,
    },
  ],
  preferredSources: [{ stage: 'qualifier-2', sourceIds: ['fixture'] }],
  overrides: [],
  preferredSeasonStandingSources: ['fixture'],
  seasonStandingOverrides: [],
  editionMappings: [{ sourceId: 'fixture', editionLabel: '2024', seasonYear: 2024 }],
};
const alias: ReviewedIdentityAlias = {
  entityType: 'team',
  sourceId: 'fixture',
  sourceIdentityId: 'team-alpha',
  seasonYear: 2024,
  canonicalId: '2024-a',
  reviewedBy: 'reviewer',
  reviewReference: 'review-1',
  reviewedAt: '2026-10-31T12:00:00Z',
};
const candidate = standingsCandidateSchema.parse({
  candidateId: 'fixture-2024-q2',
  sourceId: 'fixture',
  authorityId: 'fixture',
  discoveryUrl: 'https://example.com/index',
  finalUrl: 'https://example.com/results',
  retrievedAt: '2026-10-31T12:00:00Z',
  contentSha256: 'a'.repeat(64),
  parserVersion: 'fixture-v1',
  promptVersion: null,
  model: null,
  sourceEditionLabel: '2024',
  contest: {
    seasonYear: 2024,
    seriesId: 'gpm',
    stage: 'qualifier-2',
    name: 'Fixture q2',
    publicationState: 'final',
    date: null,
    durationMinutes: null,
    penaltyMinutesPerFailedAttempt: null,
    problemLabels: [],
  },
  rows: [
    {
      place: 1,
      sourceTeamId: 'team-alpha',
      teamName: 'Alpha',
      sourceSchoolId: null,
      schoolName: null,
      results: null,
      publishedTotals: { solved: 2, penalty: null },
      evidence: [
        {
          field: 'rows[0].place',
          kind: 'manual',
          locator: 'row 1',
          page: null,
          excerpt: '1',
          confidence: 1,
        },
      ],
    },
  ],
  coverage: { expectedRowCount: 1, rowsComplete: true, paginationComplete: true },
  warnings: [],
});
const proposal = reviewProposalSchema.parse({
  schemaVersion: 1,
  runId: 'fixture-run',
  generatedAt: '2026-10-31T12:00:00Z',
  status: 'complete',
  candidates: [candidate],
  additions: [],
  conflicts: [],
  runIssues: [],
  sourceFailures: [],
});
const materialize = (value: unknown = proposal, aliases: ReviewedIdentityAlias[] = [alias]) =>
  materializeProposal({
    proposal: value,
    archive,
    sourceConfiguration: configuration,
    identityAliases: aliases,
  });

describe('archive draft materialization', () => {
  it('reconciles current aliases and emits a complete schema-valid draft without mutating the archive', () => {
    const before = structuredClone(archive);
    const result = materialize();
    expect(result.blocked).toEqual([]);
    expect(result.files).toEqual([
      {
        path: 'data/seasons/2024/gpm/qualifier-2.json',
        candidateId: candidate.candidateId,
        record: {
          id: '2024-gpm-qualifier-2',
          seasonYear: 2024,
          seriesId: 'gpm',
          stage: 'qualifier-2',
          name: 'Fixture q2',
          date: null,
          durationMinutes: null,
          penaltyMinutesPerFailedAttempt: null,
          problems: [],
          standings: [
            {
              place: 1,
              teamId: '2024-a',
              results: null,
              publishedTotals: { solved: 2, penalty: null },
            },
          ],
          source: candidate.finalUrl,
        },
      },
    ]);
    expect(archive).toEqual(before);
  });

  it('never trusts saved addition references to bypass missing identities or coverage', () => {
    const forged = {
      ...proposal,
      additions: [{ candidateId: candidate.candidateId, rowIndex: 0 }],
    };
    expect(materialize(forged, []).files).toEqual([]);
    expect(
      materialize({
        ...forged,
        candidates: [{ ...candidate, coverage: { ...candidate.coverage, rowsComplete: false } }],
      }).files,
    ).toEqual([]);
  });

  it('blocks existing targets and competing candidates', () => {
    const existing = { ...candidate, contest: { ...candidate.contest, stage: 'qualifier-1' } };
    expect(materialize({ ...proposal, candidates: [existing] }).blocked[0].reason).toContain(
      'already exists',
    );
    const competing = { ...candidate, candidateId: 'fixture-alternative' };
    expect(materialize({ ...proposal, candidates: [candidate, competing] }).files).toEqual([]);
    expect(materialize({ ...proposal, candidates: [candidate, competing] }).blocked).toHaveLength(
      2,
    );
  });

  it('blocks failed runs and non-final records', () => {
    expect(materialize({ ...proposal, status: 'failed' }).files).toEqual([]);
    expect(
      materialize({
        ...proposal,
        candidates: [
          { ...candidate, contest: { ...candidate.contest, publicationState: 'provisional' } },
        ],
      }).files,
    ).toEqual([]);
  });

  it('preserves detailed results and omits unavailable published totals', () => {
    const detailed = {
      ...candidate,
      contest: {
        ...candidate.contest,
        problemLabels: ['A'],
        durationMinutes: 300,
        penaltyMinutesPerFailedAttempt: 20,
      },
      rows: [
        {
          ...candidate.rows[0],
          results: [{ status: 'solved', attempts: 2, solvedAtMinute: 10 }],
          publishedTotals: null,
        },
      ],
    };
    const result = materialize({ ...proposal, candidates: [detailed] });
    expect(result.files[0].record).toMatchObject({
      problems: [{ label: 'A' }],
      standings: [{ results: [{ status: 'solved', attempts: 2, solvedAtMinute: 10 }] }],
    });
    expect(JSON.stringify(result.files[0].record)).not.toContain('publishedTotals');
  });

  it('materializes final accumulated scores and retains score-unit review evidence', () => {
    const standing = seasonStandingCandidateSchema.parse({
      candidateId: 'fixture-standing',
      sourceId: candidate.sourceId,
      authorityId: candidate.authorityId,
      discoveryUrl: candidate.discoveryUrl,
      finalUrl: candidate.finalUrl,
      retrievedAt: candidate.retrievedAt,
      contentSha256: candidate.contentSha256,
      parserVersion: candidate.parserVersion,
      sourceEditionLabel: '2024',
      seasonYear: 2024,
      seriesId: 'other-series',
      snapshot: 'latest-explicit',
      scoreUnit: 'Puntos',
      rows: [
        {
          place: 1,
          sourceTeamId: 'team-alpha',
          teamName: 'Alpha',
          score: 12.5,
          scoreText: '12.5',
          scoreUnit: 'Puntos',
          qualified: null,
          qualificationText: null,
          pageNumber: 1,
          confidence: null,
          evidence: ['place', 'teamName', 'score'].map((field) => ({
            ...candidate.rows[0].evidence[0],
            field: `rows[0].${field}`,
          })),
        },
      ],
      pageNumbers: [1],
      coverage: { expectedRowCount: 1, rowsComplete: true, pagesComplete: true },
      warnings: [],
    });
    const value = { ...proposal, candidates: [], seasonStandingCandidates: [standing] };
    const result = materialize(value);
    expect(result.files[0]).toMatchObject({
      path: 'data/seasons/2024/other-series/standing.json',
      record: {
        rows: [{ place: 1, teamId: '2024-a', score: 12.5, qualified: null }],
        scoreUnit: 'Puntos',
        snapshot: 'latest-explicit',
      },
    });
    expect(result.warnings).toContain('fixture-standing: accumulated score unit is Puntos.');
    expect(
      materialize({
        ...value,
        seasonStandingCandidates: [{ ...standing, snapshot: 'intermediate' }],
      }).files,
    ).toEqual([]);
    expect(
      materialize({ ...value, seasonStandingCandidates: [{ ...standing, seriesId: 'gpm' }] })
        .blocked[0].reason,
    ).toContain('already exists');
  });

  it('blocks saved source failures and non-identity conflicts even when a fresh reconciliation allows rows', () => {
    expect(
      materialize({
        ...proposal,
        status: 'partial',
        sourceFailures: [{ sourceId: 'fixture', contest: null, message: 'Truncated response.' }],
      }).files,
    ).toEqual([]);
    const conflict = {
      contest: candidate.contest,
      entityId: '2024-a',
      field: 'score',
      kind: 'source',
      currentValue: null,
      alternatives: [
        { candidateId: candidate.candidateId, value: '2', evidence: candidate.rows[0].evidence },
      ],
    };
    expect(materialize({ ...proposal, conflicts: [conflict] }).files).toEqual([]);
  });

  it('blocks corrupt aliases, unmapped editions, and nonunique canonical team resolution', () => {
    expect(materialize(proposal, [{ ...alias, canonicalId: 'missing-team' }]).files).toEqual([]);
    expect(
      materialize({ ...proposal, candidates: [{ ...candidate, sourceEditionLabel: 'unmapped' }] })
        .files,
    ).toEqual([]);
    const duplicateTeam = {
      ...candidate,
      rows: [candidate.rows[0], { ...candidate.rows[0], place: 2, sourceTeamId: 'team-beta' }],
      coverage: { ...candidate.coverage, expectedRowCount: 2 },
    };
    const result = materialize({ ...proposal, candidates: [duplicateTeam] }, [
      alias,
      { ...alias, sourceIdentityId: 'team-beta' },
    ]);
    expect(result.files).toEqual([]);
    expect(result.blocked[0].reason).toContain('resolve uniquely');
  });

  it('retains independent eligible drafts from partial runs and rejects invalid configuration', () => {
    const value = {
      ...proposal,
      status: 'partial',
      sourceFailures: [
        { sourceId: 'other-source', contest: null, message: 'Other source failed.' },
      ],
    };
    expect(materialize(value).files).toHaveLength(1);
    expect(materialize(value).warnings).toContain('Other source failed.');
    const result = materializeProposal({
      proposal,
      archive,
      sourceConfiguration: {},
      identityAliases: [alias],
    });
    expect(result.files).toEqual([]);
    expect(result.warnings).toHaveLength(2);
  });
});
