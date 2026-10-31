import { describe, expect, it } from 'vitest';

import { archive, contest } from '@/test/fixtures/archive';

import { reconcileCandidates } from './reconcile';

import type { ReviewedIdentityAlias } from './identities';
import type { SeasonStandingCandidate, SourceConfiguration, StandingsCandidate } from './schemas';

const sourceConfiguration: SourceConfiguration = {
  schemaVersion: 1,
  sources: [
    {
      id: 'icpc-mexico',
      authorityId: 'icpc-mexico',
      name: 'ICPC Mexico',
      baseUrl: 'https://icpcmexico.org/contests',
      supportedStages: ['qualifier-1', 'qualifier-2'],
      supportsSeasonStanding: true,
    },
  ],
  preferredSources: [{ stage: 'qualifier-1', sourceIds: ['icpc-mexico'] }],
  overrides: [],
  preferredSeasonStandingSources: ['icpc-mexico'],
  seasonStandingOverrides: [],
  editionMappings: [{ sourceId: 'icpc-mexico', editionLabel: '2024', seasonYear: 2024 }],
};

const identityAliases: ReviewedIdentityAlias[] = [
  {
    entityType: 'school',
    sourceId: 'icpc-mexico',
    sourceIdentityId: 'school-unit',
    seasonYear: null,
    canonicalId: 'unit',
    reviewedBy: 'maintainer',
    reviewReference: 'pull-request-42',
    reviewedAt: '2026-10-28T12:00:00Z',
  },
  {
    entityType: 'team',
    sourceId: 'icpc-mexico',
    sourceIdentityId: 'source-alpha',
    seasonYear: 2024,
    canonicalId: '2024-a',
    reviewedBy: 'maintainer',
    reviewReference: 'pull-request-42',
    reviewedAt: '2026-10-28T12:00:00Z',
  },
];

const makeCandidate = (overrides: Partial<StandingsCandidate> = {}): StandingsCandidate => ({
  candidateId: 'icpc-mexico-2024-q1-contenthash',
  sourceId: 'icpc-mexico',
  authorityId: 'icpc-mexico',
  discoveryUrl: 'https://icpcmexico.org/contests',
  finalUrl: 'https://icpcmexico.org/contests/2024/q1',
  retrievedAt: '2026-10-28T12:00:00Z',
  contentSha256: 'a'.repeat(64),
  parserVersion: 'icpc-mexico-v1',
  promptVersion: null,
  model: null,
  sourceEditionLabel: '2024',
  contest: {
    seasonYear: 2024,
    seriesId: 'gpm',
    stage: 'qualifier-2',
    name: 'GPM 2024 qualifier 2',
    publicationState: 'final',
    date: '2024-05-01',
    durationMinutes: 300,
    penaltyMinutesPerFailedAttempt: 15,
    problemLabels: ['A', 'B', 'C'],
  },
  rows: [
    {
      place: 1,
      sourceTeamId: 'source-alpha',
      teamName: 'Alpha source name',
      sourceSchoolId: 'school-unit',
      schoolName: 'Unit source name',
      results: contest.standings[0].results,
      publishedTotals: { solved: 1, penalty: 25 },
      evidence: [
        {
          field: 'rows[0].place',
          kind: 'html-cell',
          locator: 'table tr:nth-child(1) td:nth-child(1)',
          page: null,
          excerpt: '1',
          confidence: 1,
        },
        {
          field: 'rows[0].teamName',
          kind: 'html-cell',
          locator: 'table tr:nth-child(1) td:nth-child(2)',
          page: null,
          excerpt: 'Alpha source name',
          confidence: 1,
        },
      ],
    },
  ],
  coverage: {
    expectedRowCount: 1,
    rowsComplete: true,
    paginationComplete: true,
  },
  warnings: [],
  ...overrides,
});

const makeSeasonStandingCandidate = (
  overrides: Partial<SeasonStandingCandidate> = {},
): SeasonStandingCandidate => ({
  candidateId: 'icpc-mexico-2024-gpm-standing-contenthash',
  sourceId: 'icpc-mexico',
  authorityId: 'icpc-mexico',
  discoveryUrl: 'https://icpcmexico.org/contests',
  finalUrl: 'https://icpcmexico.org/contests/2024/standing.pdf',
  retrievedAt: '2026-10-28T12:00:00Z',
  contentSha256: 'b'.repeat(64),
  parserVersion: 'iteso-season-standing-v1',
  sourceEditionLabel: '2024',
  seasonYear: 2024,
  seriesId: 'gpm',
  snapshot: 'latest-explicit',
  scoreUnit: 'points',
  rows: [
    {
      place: 1,
      sourceTeamId: 'source-alpha',
      teamName: 'Alpha source name',
      score: 12.75,
      scoreText: '12.75',
      scoreUnit: 'points',
      qualificationText: 'Sí',
      qualified: true,
      pageNumber: 1,
      confidence: 1,
      evidence: [
        {
          field: 'rows[0].place',
          kind: 'pdf-text',
          locator: 'page 1 row 1 place',
          page: 1,
          excerpt: '1',
          confidence: 1,
        },
        {
          field: 'rows[0].teamName',
          kind: 'pdf-text',
          locator: 'page 1 row 1 team name',
          page: 1,
          excerpt: 'Alpha source name',
          confidence: 1,
        },
        {
          field: 'rows[0].score',
          kind: 'pdf-text',
          locator: 'page 1 row 1 score',
          page: 1,
          excerpt: '12.75',
          confidence: 1,
        },
      ],
    },
  ],
  pageNumbers: [1],
  coverage: { expectedRowCount: 1, rowsComplete: true, pagesComplete: true },
  warnings: [],
  ...overrides,
});

const reconcile = (
  candidates: readonly unknown[],
  options: {
    archive?: typeof archive;
    aliases?: readonly unknown[];
    seasonStandingCandidates?: readonly unknown[];
    sourceConfiguration?: unknown;
  } = {},
) =>
  reconcileCandidates({
    archive: options.archive ?? archive,
    candidates,
    seasonStandingCandidates: options.seasonStandingCandidates,
    sourceConfiguration: options.sourceConfiguration ?? sourceConfiguration,
    identityAliases: options.aliases ?? identityAliases,
    runId: 'test-run-1',
    generatedAt: '2026-10-28T12:01:00Z',
  });

describe('dry-run standings reconciliation', () => {
  it('proposes only reviewed identities and does not mutate archive data', () => {
    const before = structuredClone(archive);
    const proposal = reconcile([makeCandidate()]);
    expect(proposal).toMatchObject({
      status: 'complete',
      additions: [{ candidateId: 'icpc-mexico-2024-q1-contenthash', rowIndex: 0 }],
      conflicts: [],
      runIssues: [],
    });
    expect(archive).toEqual(before);
  });

  it('produces the same proposal for identical inputs and run metadata', () => {
    const first = reconcile([makeCandidate()]);
    const second = reconcile([makeCandidate()]);
    expect(second).toEqual(first);
  });

  it('reports changed archived fields without replacing or deleting published rows', () => {
    const existing = {
      ...contest,
      stage: 'qualifier-1' as const,
      standings: [
        { ...contest.standings[1], place: 1 },
        { ...contest.standings[0], place: 2 },
      ],
    };
    const sourceArchive = { ...archive, contests: [existing] };
    const before = structuredClone(sourceArchive);
    const proposal = reconcile(
      [
        makeCandidate({
          contest: { ...makeCandidate().contest, stage: 'qualifier-1' },
          rows: [
            {
              ...makeCandidate().rows[0],
              place: 1,
            },
          ],
        }),
      ],
      { archive: sourceArchive },
    );
    expect(proposal).toMatchObject({ status: 'complete', sourceFailures: [], runIssues: [] });
    expect(proposal.additions).toEqual([]);
    expect(proposal.conflicts).toContainEqual(
      expect.objectContaining({
        entityId: '2024-a',
        field: 'place',
        kind: 'archive',
        currentValue: '2',
        alternatives: [
          expect.objectContaining({ value: '1', candidateId: 'icpc-mexico-2024-q1-contenthash' }),
        ],
      }),
    );
    expect(sourceArchive).toEqual(before);
  });

  it('stages missing reviewed identities instead of merging by team or school name', () => {
    const proposal = reconcile([makeCandidate()], { aliases: [] });
    expect(proposal.additions).toEqual([]);
    expect(proposal.conflicts).toContainEqual(
      expect.objectContaining({
        kind: 'identity',
        field: 'teamId',
        alternatives: [expect.objectContaining({ value: 'Alpha source name' })],
      }),
    );
    expect(proposal.identityProposals).toEqual([
      {
        candidateId: 'icpc-mexico-2024-q1-contenthash',
        rowIndex: 0,
        sourceId: 'icpc-mexico',
        seasonYear: 2024,
        sourceTeamId: 'source-alpha',
        teamName: 'Alpha source name',
        sourceSchoolId: 'school-unit',
        schoolName: 'Unit source name',
      },
    ]);
  });

  it('keeps valid independent additions when another source candidate fails', () => {
    const failed = makeCandidate({
      candidateId: 'removed-source-candidate',
      sourceId: 'removed-source',
      authorityId: 'removed-source',
    });
    const proposal = reconcile([makeCandidate(), failed]);
    expect(proposal.status).toBe('partial');
    expect(proposal.additions).toEqual([
      { candidateId: 'icpc-mexico-2024-q1-contenthash', rowIndex: 0 },
    ]);
    expect(proposal.sourceFailures).toEqual([
      expect.objectContaining({ sourceId: 'removed-source' }),
    ]);
  });

  it('keeps valid candidates when another candidate fails schema validation', () => {
    const proposal = reconcile([makeCandidate(), { sourceId: 'icpc-mexico', rows: [] }]);
    expect(proposal.status).toBe('partial');
    expect(proposal.additions).toEqual([
      { candidateId: 'icpc-mexico-2024-q1-contenthash', rowIndex: 0 },
    ]);
    expect(proposal.sourceFailures).toHaveLength(1);
    expect(proposal.sourceFailures[0].sourceId).toBe('icpc-mexico');
    expect(proposal.sourceFailures[0].message).toContain('candidate validation failed');
  });

  it('keeps incomplete tables reviewable but blocks their rows from additions', () => {
    const incomplete = makeCandidate({
      coverage: { expectedRowCount: 2, rowsComplete: false, paginationComplete: null },
    });
    const proposal = reconcile([incomplete]);
    expect(proposal.status).toBe('partial');
    expect(proposal.candidates).toHaveLength(1);
    expect(proposal.additions).toEqual([]);
    expect(proposal.sourceFailures).toEqual([
      expect.objectContaining({
        message: 'source did not confirm that all standings rows were collected',
      }),
      expect.objectContaining({ message: 'source pagination is incomplete or unknown' }),
      expect.objectContaining({ message: 'expected 2 rows but collected 1' }),
    ]);
  });

  it('blocks additions and reports corrupt alias targets at run scope', () => {
    const badAliases = identityAliases.map((alias) => ({
      ...alias,
      canonicalId: 'missing-target',
    })) as ReviewedIdentityAlias[];
    const proposal = reconcile([makeCandidate()], { aliases: badAliases });
    expect(proposal.status).toBe('partial');
    expect(proposal.additions).toEqual([]);
    expect(proposal.runIssues).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'identity-registry' })]),
    );
  });

  it('fails closed when source configuration is invalid', () => {
    const proposal = reconcile([makeCandidate()], { sourceConfiguration: {} });
    expect(proposal.status).toBe('failed');
    expect(proposal.candidates).toEqual([]);
    expect(proposal.additions).toEqual([]);
    expect(proposal.runIssues).toEqual([expect.objectContaining({ kind: 'configuration' })]);
  });

  it('does not propose live or provisional candidates as additions', () => {
    const proposal = reconcile([
      makeCandidate({
        contest: { ...makeCandidate().contest, publicationState: 'provisional' },
      }),
    ]);
    expect(proposal.additions).toEqual([]);
    expect(proposal.conflicts).toContainEqual(
      expect.objectContaining({
        field: 'publicationState',
        kind: 'publication-state',
      }),
    );
  });

  it('uses reviewed exact team identities to compare season standings with the archive', () => {
    const candidate = makeSeasonStandingCandidate({
      rows: [
        {
          ...makeSeasonStandingCandidate().rows[0],
          score: 14,
          scoreText: '14',
          evidence: makeSeasonStandingCandidate().rows[0].evidence.map((evidence) =>
            evidence.field === 'rows[0].score' ? { ...evidence, excerpt: '14' } : evidence,
          ),
        },
      ],
    });
    const proposal = reconcile([], { seasonStandingCandidates: [candidate] });

    expect(proposal.status).toBe('complete');
    expect(proposal.seasonStandingAdditions).toEqual([]);
    expect(proposal.seasonStandingConflicts).toContainEqual(
      expect.objectContaining({
        entityId: '2024-a',
        field: 'score',
        kind: 'archive',
        currentValue: '12.75',
        alternatives: [
          expect.objectContaining({ candidateId: candidate.candidateId, value: '14' }),
        ],
      }),
    );
  });

  it('proposes only complete explicit-final season standings and retains unresolved rows for review', () => {
    const emptyStandingArchive = { ...archive, seasonStandings: [] };
    const finalProposal = reconcile([], {
      archive: emptyStandingArchive,
      seasonStandingCandidates: [makeSeasonStandingCandidate()],
    });
    expect(finalProposal.seasonStandingAdditions).toEqual([
      { candidateId: 'icpc-mexico-2024-gpm-standing-contenthash', rowIndex: 0 },
    ]);

    const intermediateProposal = reconcile([], {
      archive: emptyStandingArchive,
      seasonStandingCandidates: [makeSeasonStandingCandidate({ snapshot: 'intermediate' })],
    });
    expect(intermediateProposal.seasonStandingAdditions).toEqual([]);
    expect(intermediateProposal.seasonStandingConflicts).toContainEqual(
      expect.objectContaining({ field: 'snapshot', kind: 'publication-state' }),
    );

    const unresolvedProposal = reconcile([], {
      archive: emptyStandingArchive,
      aliases: [],
      seasonStandingCandidates: [makeSeasonStandingCandidate()],
    });
    expect(unresolvedProposal.seasonStandingAdditions).toEqual([]);
    expect(unresolvedProposal.seasonStandingConflicts).toContainEqual(
      expect.objectContaining({ field: 'teamId', kind: 'identity' }),
    );
    expect(unresolvedProposal.identityProposals).toEqual([
      {
        candidateId: 'icpc-mexico-2024-gpm-standing-contenthash',
        rowIndex: 0,
        sourceId: 'icpc-mexico',
        seasonYear: 2024,
        sourceTeamId: 'source-alpha',
        teamName: 'Alpha source name',
        sourceSchoolId: null,
        schoolName: null,
      },
    ]);
  });

  it('keeps incomplete season-standing candidates reviewable but blocks additions', () => {
    const proposal = reconcile([], {
      archive: { ...archive, seasonStandings: [] },
      seasonStandingCandidates: [
        makeSeasonStandingCandidate({
          coverage: { expectedRowCount: 2, rowsComplete: false, pagesComplete: false },
        }),
      ],
    });
    expect(proposal.status).toBe('partial');
    expect(proposal.seasonStandingCandidates).toHaveLength(1);
    expect(proposal.seasonStandingAdditions).toEqual([]);
    expect(proposal.sourceFailures.map(({ message }) => message)).toEqual(
      expect.arrayContaining([
        'source did not confirm that all season-standing rows were collected',
        'source document pages are incomplete or unknown',
        'expected 2 rows but collected 1',
      ]),
    );
  });
});
