import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  candidateCoverageIssues,
  mapSourceEdition,
  reviewProposalSchema,
  seasonStandingCandidateCoverageIssues,
  seasonStandingCandidateSchema,
  selectPreferredSeasonStandingSourceIds,
  selectPreferredSourceIds,
  sourceConfigurationSchema,
  standingsCandidateSchema,
  validateCandidateSource,
  validateSeasonStandingCandidateSource,
} from './schemas';

const sourceConfiguration = {
  schemaVersion: 1,
  sources: [
    {
      id: 'icpc-mexico',
      authorityId: 'icpc-mexico',
      name: 'ICPC Mexico',
      baseUrl: 'https://icpcmexico.org',
      supportedStages: [
        'fecha-0',
        'qualifier-1',
        'qualifier-2',
        'qualifier-3',
        'repechage',
        'final',
      ],
      supportsSeasonStanding: true,
    },
    {
      id: 'iteso',
      authorityId: 'iteso',
      name: 'ITESO archive',
      baseUrl: 'https://eventos.iteso.mx',
      supportedStages: ['qualifier-1', 'qualifier-2', 'qualifier-3', 'repechage'],
      supportsSeasonStanding: true,
    },
  ],
  preferredSources: [{ stage: 'qualifier-1', sourceIds: ['icpc-mexico', 'iteso'] }],
  overrides: [{ seasonYear: 2020, seriesId: 'gpm', stage: 'qualifier-1', sourceIds: ['iteso'] }],
  preferredSeasonStandingSources: ['icpc-mexico', 'iteso'],
  seasonStandingOverrides: [{ seasonYear: 2020, seriesId: 'gpm', sourceIds: ['iteso'] }],
  editionMappings: [{ sourceId: 'icpc-mexico', editionLabel: '2021 cycle', seasonYear: 2020 }],
};

const candidate = {
  candidateId: 'icpc-mexico-2020-q1-abc123',
  sourceId: 'icpc-mexico',
  authorityId: 'icpc-mexico',
  discoveryUrl: 'https://icpcmexico.org/contests',
  finalUrl: 'https://icpcmexico.org/contest/2021-cycle',
  retrievedAt: '2026-10-28T12:00:00Z',
  contentSha256: 'a'.repeat(64),
  parserVersion: 'icpc-mexico-v1',
  promptVersion: null,
  model: null,
  sourceEditionLabel: '2021 cycle',
  contest: {
    seasonYear: 2020,
    seriesId: 'gpm',
    stage: 'qualifier-1',
    name: 'GPM 2020 qualifier 1',
    publicationState: 'final',
    date: null,
    durationMinutes: 300,
    penaltyMinutesPerFailedAttempt: 20,
    problemLabels: ['A'],
  },
  rows: [
    {
      place: 1,
      sourceTeamId: 'team-01',
      teamName: 'Fixture Alpha',
      sourceSchoolId: null,
      schoolName: 'School Alpha',
      results: [{ status: 'solved', attempts: 1, solvedAtMinute: 10 }],
      publishedTotals: { solved: 1, penalty: 10 },
      evidence: [
        {
          field: 'rows[0].place',
          kind: 'html-cell',
          locator: 'table#standings tbody tr:nth-child(1) td.place',
          page: null,
          excerpt: '1',
          confidence: 1,
        },
        {
          field: 'rows[0].teamName',
          kind: 'html-cell',
          locator: 'table#standings tbody tr:nth-child(1) td.team',
          page: null,
          excerpt: 'Fixture Alpha',
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
};

const seasonStandingCandidate = {
  candidateId: 'iteso-gpm-2025-abc123',
  sourceId: 'iteso',
  authorityId: 'iteso',
  discoveryUrl: 'https://eventos.iteso.mx/acm/',
  finalUrl: 'https://acm.iteso.mx/share/result.pdf',
  retrievedAt: '2026-10-31T12:00:00Z',
  contentSha256: 'b'.repeat(64),
  parserVersion: 'iteso-season-standing-v1',
  sourceEditionLabel: '2025',
  seasonYear: 2025,
  seriesId: 'gpm',
  snapshot: 'latest-explicit',
  scoreUnit: 'Puntos',
  rows: [
    {
      place: 1,
      sourceTeamId: 'Equipo Alpha',
      teamName: 'Equipo Alpha',
      score: 12.5,
      scoreText: '12.5',
      scoreUnit: 'Puntos',
      qualificationText: 'Sí',
      qualified: true,
      pageNumber: 1,
      confidence: 0.96,
      evidence: [
        {
          field: 'rows[0].place',
          kind: 'pdf-text',
          locator: 'page 1 table row 1 place',
          page: 1,
          excerpt: '1',
          confidence: 0.96,
        },
        {
          field: 'rows[0].teamName',
          kind: 'pdf-text',
          locator: 'page 1 table row 1 teamName',
          page: 1,
          excerpt: 'Equipo Alpha',
          confidence: 0.96,
        },
        {
          field: 'rows[0].score',
          kind: 'pdf-text',
          locator: 'page 1 table row 1 score',
          page: 1,
          excerpt: '12.5',
          confidence: 0.96,
        },
      ],
    },
  ],
  pageNumbers: [1],
  coverage: { expectedRowCount: 1, rowsComplete: true, pagesComplete: true },
  warnings: [],
};

describe('standings ingestion source configuration', () => {
  it('validates the committed source registry and preserves shared authority identity', () => {
    const config = JSON.parse(readFileSync('config/standings-sources.json', 'utf8')) as unknown;
    const parsed = sourceConfigurationSchema.parse(config);
    const globalSources = parsed.sources.filter(({ authorityId }) => authorityId === 'icpc-global');
    expect(globalSources.map(({ id }) => id)).toEqual([
      'icpc-global-directory',
      'icpc-global-finder',
    ]);
    expect(globalSources[0].authorityId).toBe(globalSources[1].authorityId);
    expect(selectPreferredSourceIds(parsed, 2026, 'mexico-finals', 'final')).toEqual([
      'icpc-mexico',
      'icpc-global-directory',
      'icpc-global-finder',
      'scorelatam',
    ]);
    expect(selectPreferredSeasonStandingSourceIds(parsed, 2026, 'gpm')).toEqual([
      'icpc-mexico',
      'iteso',
      'icpc-global-directory',
    ]);
  });

  it('accepts source priorities, edition-specific overrides, and explicit edition mappings', () => {
    expect(sourceConfigurationSchema.parse(sourceConfiguration)).toEqual(sourceConfiguration);
  });

  it('rejects unknown sources and sources that do not support the configured stage', () => {
    expect(
      sourceConfigurationSchema.safeParse({
        ...sourceConfiguration,
        preferredSources: [{ stage: 'final', sourceIds: ['missing-source'] }],
      }).success,
    ).toBe(false);
    expect(
      sourceConfigurationSchema.safeParse({
        ...sourceConfiguration,
        overrides: [{ seasonYear: 2020, seriesId: 'gpm', stage: 'final', sourceIds: ['iteso'] }],
      }).success,
    ).toBe(false);
  });

  it('rejects duplicate edition mappings for the same source label', () => {
    expect(
      sourceConfigurationSchema.safeParse({
        ...sourceConfiguration,
        editionMappings: [
          ...sourceConfiguration.editionMappings,
          sourceConfiguration.editionMappings[0],
        ],
      }).success,
    ).toBe(false);
  });

  it('resolves edition overrides before the default stage preference and maps labels explicitly', () => {
    const parsed = sourceConfigurationSchema.parse(sourceConfiguration);
    expect(selectPreferredSourceIds(parsed, 2020, 'gpm', 'qualifier-1')).toEqual(['iteso']);
    expect(selectPreferredSourceIds(parsed, 2024, 'gpm', 'qualifier-1')).toEqual([
      'icpc-mexico',
      'iteso',
    ]);
    expect(mapSourceEdition(parsed, 'icpc-mexico', '2021 cycle')).toBe(2020);
    expect(mapSourceEdition(parsed, 'icpc-mexico', '2020')).toBeUndefined();
    expect(selectPreferredSeasonStandingSourceIds(parsed, 2020, 'gpm')).toEqual(['iteso']);
    expect(selectPreferredSeasonStandingSourceIds(parsed, 2024, 'gpm')).toEqual([
      'icpc-mexico',
      'iteso',
    ]);
  });

  it('checks candidate authority, stage support, and edition mapping against reviewed configuration', () => {
    const parsed = sourceConfigurationSchema.parse(sourceConfiguration);
    expect(validateCandidateSource(standingsCandidateSchema.parse(candidate), parsed)).toEqual([]);
    expect(
      validateCandidateSource(
        standingsCandidateSchema.parse({
          ...candidate,
          sourceEditionLabel: 'unreviewed edition',
        }),
        parsed,
      ),
    ).toEqual(['source edition `unreviewed edition` has no reviewed season mapping']);
    expect(
      validateCandidateSource(
        standingsCandidateSchema.parse({
          ...candidate,
          authorityId: 'other-authority',
          contest: { ...candidate.contest, stage: 'final', seasonYear: 2021 },
        }),
        parsed,
      ),
    ).toEqual([
      'authority `other-authority` does not match source `icpc-mexico`',
      'source edition `2021 cycle` maps to 2020, not 2021',
    ]);
  });
});

describe('evidence-backed candidates', () => {
  it('accepts a source-backed candidate with traceable cell evidence', () => {
    expect(standingsCandidateSchema.parse(candidate)).toEqual(candidate);
  });

  it('requires evidence, complete known problem cells, and exact source content hashes', () => {
    expect(
      standingsCandidateSchema.safeParse({
        ...candidate,
        contentSha256: 'bad-hash',
      }).success,
    ).toBe(false);
    expect(
      standingsCandidateSchema.safeParse({
        ...candidate,
        rows: [{ ...candidate.rows[0], evidence: [] }],
      }).success,
    ).toBe(false);
    expect(
      standingsCandidateSchema.safeParse({
        ...candidate,
        rows: [{ ...candidate.rows[0], results: [] }],
      }).success,
    ).toBe(false);
  });

  it('rejects duplicate source identities, nonstandard places, and inconsistent published totals', () => {
    const duplicateIdentity = { ...candidate.rows[0], place: 2 };
    expect(
      standingsCandidateSchema.safeParse({
        ...candidate,
        rows: [candidate.rows[0], { ...duplicateIdentity, evidence: candidate.rows[0].evidence }],
      }).success,
    ).toBe(false);
    expect(
      standingsCandidateSchema.safeParse({
        ...candidate,
        rows: [{ ...candidate.rows[0], publishedTotals: { solved: 0, penalty: 10 } }],
      }).success,
    ).toBe(false);
  });

  it('retains totals-only rows and allows their unknown penalty to remain unknown', () => {
    const result = standingsCandidateSchema.parse({
      ...candidate,
      contest: { ...candidate.contest, problemLabels: [], penaltyMinutesPerFailedAttempt: null },
      rows: [
        {
          ...candidate.rows[0],
          results: null,
          publishedTotals: { solved: 1, penalty: null },
        },
      ],
    });
    expect(result.rows[0].publishedTotals?.penalty).toBeNull();
  });

  it('reports unconfirmed pagination and mismatched row-count coverage', () => {
    const incomplete = standingsCandidateSchema.parse({
      ...candidate,
      coverage: { expectedRowCount: 2, rowsComplete: true, paginationComplete: null },
    });
    expect(candidateCoverageIssues(incomplete)).toEqual([
      'source pagination is incomplete or unknown',
      'expected 2 rows but collected 1',
    ]);
  });
});

describe('season-standing review candidates', () => {
  it('validates source mappings, page evidence, and row coverage', () => {
    const mappedConfiguration = sourceConfigurationSchema.parse({
      ...sourceConfiguration,
      editionMappings: [
        ...sourceConfiguration.editionMappings,
        { sourceId: 'iteso', editionLabel: '2025', seasonYear: 2025 },
      ],
    });
    const parsedCandidate = seasonStandingCandidateSchema.parse(seasonStandingCandidate);
    expect(validateSeasonStandingCandidateSource(parsedCandidate, mappedConfiguration)).toEqual([]);
    expect(
      validateSeasonStandingCandidateSource(
        { ...parsedCandidate, sourceEditionLabel: '2026' },
        mappedConfiguration,
      ),
    ).toEqual(['source edition `2026` has no reviewed season mapping']);
    const incomplete = seasonStandingCandidateSchema.parse({
      ...seasonStandingCandidate,
      coverage: { ...seasonStandingCandidate.coverage, expectedRowCount: 2 },
    });
    expect(seasonStandingCandidateCoverageIssues(incomplete)).toEqual([
      'expected 2 rows but collected 1',
    ]);
    expect(
      seasonStandingCandidateSchema.safeParse({
        ...seasonStandingCandidate,
        rows: [...seasonStandingCandidate.rows, { ...seasonStandingCandidate.rows[0], place: 2 }],
      }).success,
    ).toBe(false);
  });

  it('allows additions only for explicit final snapshots with valid candidate references', () => {
    const proposal = {
      schemaVersion: 1,
      runId: 'run-2026-10-31-season-standing',
      generatedAt: '2026-10-31T12:01:00Z',
      status: 'complete',
      candidates: [],
      additions: [],
      seasonStandingCandidates: [seasonStandingCandidate],
      seasonStandingAdditions: [{ candidateId: seasonStandingCandidate.candidateId, rowIndex: 0 }],
      identityProposals: [
        {
          candidateId: seasonStandingCandidate.candidateId,
          rowIndex: 0,
          sourceId: 'iteso',
          seasonYear: 2025,
          sourceTeamId: 'Equipo Alpha',
          teamName: 'Equipo Alpha',
          sourceSchoolId: null,
          schoolName: null,
        },
      ],
      conflicts: [],
      seasonStandingConflicts: [],
      runIssues: [],
      sourceFailures: [],
    };
    expect(reviewProposalSchema.parse(proposal).seasonStandingAdditions).toEqual(
      proposal.seasonStandingAdditions,
    );
    expect(reviewProposalSchema.parse(proposal).identityProposals).toEqual(
      proposal.identityProposals,
    );
    expect(
      reviewProposalSchema.safeParse({
        ...proposal,
        seasonStandingCandidates: [{ ...seasonStandingCandidate, snapshot: 'intermediate' }],
      }).success,
    ).toBe(false);
    expect(
      reviewProposalSchema.safeParse({
        ...proposal,
        seasonStandingAdditions: [
          { candidateId: seasonStandingCandidate.candidateId, rowIndex: 1 },
        ],
      }).success,
    ).toBe(false);
  });
});

describe('versioned review proposals', () => {
  it('accepts complete proposals with evidence-backed additions and conflicts', () => {
    const proposal = {
      schemaVersion: 1,
      runId: 'run-2026-10-28-01',
      generatedAt: '2026-10-28T12:01:00Z',
      status: 'complete',
      candidates: [candidate],
      additions: [{ candidateId: candidate.candidateId, rowIndex: 0 }],
      conflicts: [
        {
          contest: { seasonYear: 2020, seriesId: 'gpm', stage: 'qualifier-1' },
          entityId: '2020-alpha',
          field: 'place',
          kind: 'archive',
          currentValue: '2',
          alternatives: [
            {
              value: '1',
              candidateId: candidate.candidateId,
              evidence: [candidate.rows[0].evidence[0]],
            },
          ],
        },
      ],
      runIssues: [],
      sourceFailures: [],
    };
    expect(reviewProposalSchema.parse(proposal)).toEqual({
      ...proposal,
      seasonStandingCandidates: [],
      seasonStandingAdditions: [],
      identityProposals: [],
      seasonStandingConflicts: [],
    });
  });

  it('allows independent additions from partial runs, but rejects failed or invalid runs and dangling references', () => {
    const base = {
      schemaVersion: 1,
      runId: 'run-2026-10-28-02',
      generatedAt: '2026-10-28T12:01:00Z',
      status: 'partial',
      candidates: [candidate],
      additions: [{ candidateId: candidate.candidateId, rowIndex: 0 }],
      conflicts: [],
      runIssues: [],
      sourceFailures: [
        {
          sourceId: 'icpc-mexico',
          contest: null,
          message: 'source timeout',
        },
      ],
    };
    expect(reviewProposalSchema.safeParse(base).success).toBe(true);
    expect(
      reviewProposalSchema.safeParse({
        ...base,
        status: 'failed',
        additions: [{ candidateId: candidate.candidateId, rowIndex: 0 }],
        sourceFailures: [],
      }).success,
    ).toBe(false);
    expect(
      reviewProposalSchema.safeParse({
        ...base,
        status: 'partial',
        runIssues: [{ kind: 'identity-registry', message: 'invalid alias target' }],
        sourceFailures: [],
      }).success,
    ).toBe(false);
    expect(
      reviewProposalSchema.safeParse({
        ...base,
        status: 'complete',
        additions: [{ candidateId: candidate.candidateId, rowIndex: 99 }],
        sourceFailures: [],
      }).success,
    ).toBe(false);
    expect(reviewProposalSchema.safeParse({ ...base, schemaVersion: 2 }).success).toBe(false);
  });

  it('does not allow provisional candidates as additions or mark failed sources complete', () => {
    const provisional = {
      ...candidate,
      contest: { ...candidate.contest, publicationState: 'provisional' },
    };
    const proposal = {
      schemaVersion: 1,
      runId: 'run-2026-10-28-03',
      generatedAt: '2026-10-28T12:01:00Z',
      status: 'complete',
      candidates: [provisional],
      additions: [{ candidateId: provisional.candidateId, rowIndex: 0 }],
      conflicts: [],
      runIssues: [],
      sourceFailures: [],
    };
    expect(reviewProposalSchema.safeParse(proposal).success).toBe(false);
    expect(
      reviewProposalSchema.safeParse({
        ...proposal,
        additions: [],
        sourceFailures: [{ sourceId: 'icpc-mexico', contest: null, message: 'timeout' }],
      }).success,
    ).toBe(false);
  });
});
