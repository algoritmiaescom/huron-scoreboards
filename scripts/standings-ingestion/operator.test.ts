import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { archive } from '@/test/fixtures/archive';

import { createReviewProposal, selectCandidateInputs, writeProposalAtomically } from './operator';

import type { ReviewProposal } from '@/features/scoreboards/ingestion/schemas';

const sourceConfiguration = {
  schemaVersion: 1,
  sources: [
    {
      id: 'icpc-mexico',
      authorityId: 'icpc-mexico',
      name: 'ICPC Mexico',
      baseUrl: 'https://icpcmexico.org/contests',
      supportedStages: ['qualifier-1'],
      supportsSeasonStanding: false,
    },
  ],
  preferredSources: [{ stage: 'qualifier-1', sourceIds: ['icpc-mexico'] }],
  overrides: [],
  preferredSeasonStandingSources: [],
  seasonStandingOverrides: [],
  editionMappings: [{ sourceId: 'icpc-mexico', editionLabel: '2024', seasonYear: 2024 }],
};

const candidate = {
  candidateId: 'candidate-2024-alpha',
  sourceId: 'icpc-mexico',
  authorityId: 'icpc-mexico',
  discoveryUrl: 'https://icpcmexico.org/contests',
  finalUrl: 'https://icpcmexico.org/2024/q1',
  retrievedAt: '2026-10-28T12:00:00Z',
  contentSha256: 'a'.repeat(64),
  parserVersion: 'parser-v1',
  promptVersion: null,
  model: null,
  sourceEditionLabel: '2024',
  contest: {
    seasonYear: 2024,
    seriesId: 'gpm',
    stage: 'qualifier-1',
    name: 'GPM 2024 qualifier 1',
    publicationState: 'final',
    date: null,
    durationMinutes: 300,
    penaltyMinutesPerFailedAttempt: 20,
    problemLabels: ['A'],
  },
  rows: [
    {
      place: 1,
      sourceTeamId: 'team-a',
      teamName: 'Alpha',
      sourceSchoolId: null,
      schoolName: null,
      results: [{ status: 'solved', attempts: 1, solvedAtMinute: 10 }],
      publishedTotals: { solved: 1, penalty: 10 },
      evidence: [
        {
          field: 'rows[0].place',
          kind: 'html-cell',
          locator: 'table tr:nth-child(1) td.place',
          page: null,
          excerpt: '1',
          confidence: 1,
        },
      ],
    },
  ],
  coverage: { expectedRowCount: 1, rowsComplete: true, paginationComplete: true },
  warnings: [],
};

const minimalProposal: ReviewProposal = {
  schemaVersion: 1,
  runId: 'run-test-1',
  generatedAt: '2026-10-28T12:01:00Z',
  status: 'failed',
  candidates: [],
  additions: [],
  conflicts: [],
  runIssues: [],
  sourceFailures: [],
};

describe('standings ingestion operator', () => {
  it('filters candidates by exact source and edition selectors while retaining invalid inputs for diagnostics', () => {
    const otherEdition = {
      ...candidate,
      candidateId: 'candidate-2025-beta',
      sourceEditionLabel: '2025',
      contest: { ...candidate.contest, seasonYear: 2025 },
    };
    expect(
      selectCandidateInputs([candidate, otherEdition, { sourceId: 'icpc-mexico' }], {
        sourceId: 'icpc-mexico',
        seasonYear: 2024,
        seriesId: 'gpm',
        stage: 'qualifier-1',
      }),
    ).toEqual([candidate, { sourceId: 'icpc-mexico' }]);
  });

  it('creates a validated dry-run proposal from selected evidence and aliases', () => {
    const proposal = createReviewProposal({
      archive,
      candidates: [candidate],
      sourceConfiguration,
      identityAliases: [],
      selection: { seasonYear: 2024, seriesId: 'gpm', stage: 'qualifier-1' },
      runId: 'run-test-2',
      generatedAt: '2026-10-28T12:01:00Z',
    });
    expect(proposal.status).toBe('complete');
    expect(proposal.additions).toEqual([]);
    expect(proposal.conflicts).toContainEqual(expect.objectContaining({ kind: 'identity' }));
  });

  it('writes a validated proposal atomically without replacing an existing review file', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'huron-proposal-'));
    try {
      const output = await writeProposalAtomically(directory, 'run-test-1.json', minimalProposal);
      const serialized = await readFile(output, 'utf8');
      expect(JSON.parse(serialized)).toEqual(minimalProposal);
      expect(await readdir(directory)).toEqual(['run-test-1.json']);
      await expect(
        writeProposalAtomically(directory, 'run-test-1.json', {
          ...minimalProposal,
          runId: 'replacement',
        }),
      ).rejects.toThrow();
      expect(JSON.parse(await readFile(output, 'utf8'))).toEqual(minimalProposal);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it.each(['../escape.json', '.hidden.json', 'run.json.tmp', 'bad/name.json'])(
    'rejects unsafe proposal filename %s',
    async (fileName) => {
      const directory = await mkdtemp(path.join(tmpdir(), 'huron-proposal-name-'));
      try {
        await expect(writeProposalAtomically(directory, fileName, minimalProposal)).rejects.toThrow(
          /simple JSON filename/,
        );
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
  );
});
