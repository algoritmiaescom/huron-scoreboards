import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { runStandingsIngestion } from './cli';

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

const identityRegistry = { schemaVersion: 1, aliases: [] };
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

const createRoot = async (): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), 'huron-standings-cli-'));
  await mkdir(path.join(root, 'config'), { recursive: true });
  await writeFile(
    path.join(root, 'config/standings-sources.json'),
    JSON.stringify(sourceConfiguration),
  );
  await writeFile(
    path.join(root, 'config/standings-identities.json'),
    JSON.stringify(identityRegistry),
  );
  return root;
};

describe('standings ingestion CLI', () => {
  it('loads selected candidate inputs and emits an atomic review proposal without changing archive data', async () => {
    const root = await createRoot();
    try {
      const candidateFile = path.join(root, 'candidate.json');
      await writeFile(candidateFile, JSON.stringify([candidate]));
      const result = await runStandingsIngestion(
        [
          '--season',
          '2024',
          '--source',
          'icpc-mexico',
          '--output-dir',
          '.standings-ingestion/proposals',
          candidateFile,
        ],
        root,
      );
      expect(result.status).toBe('complete');
      const proposal = JSON.parse(await readFile(result.proposalPath, 'utf8')) as {
        status: string;
        additions: unknown[];
        conflicts: { kind: string }[];
      };
      expect(proposal.status).toBe('complete');
      expect(proposal.additions).toEqual([]);
      expect(proposal.conflicts).toContainEqual(expect.objectContaining({ kind: 'identity' }));
      expect(await readFile(candidateFile, 'utf8')).toBe(JSON.stringify([candidate]));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects invalid edition arguments before reading candidate files', async () => {
    await expect(runStandingsIngestion(['--season', 'not-a-year', 'missing.json'])).rejects.toThrow(
      '--season must be an integer',
    );
  });
});
