import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { BoundedJsonCache } from './cache';
import { runStandingsIngestion } from './cli';

import type { AcquisitionDependencies } from './acquire';
import type { BoundedSourceFetcher, SourceFetchResult } from './fetch';

const sourceConfiguration = {
  schemaVersion: 1,
  sources: [
    {
      id: 'icpc-mexico',
      authorityId: 'icpc-mexico',
      name: 'ICPC Mexico',
      baseUrl: 'https://www.icpcmexico.org/contests',
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

const discoveryHtml = `<!doctype html><html><body>
  <h2>Temporada 2024</h2>
  <a href="/contests/gpmx-2024-fecha-1">Primera Fecha</a>
</body></html>`;

const eventHtml =
  '<header><p>Gran Premio MX 2024 — Primera Fecha</p></header><a href="/contests/gpmx-2024-fecha-1/scoreboard">Vista solo scoreboard</a>';

const scoreboardHtml = `<!doctype html><html lang="es"><body><header>
  <p>Gran Premio MX 2024 — Primera Fecha</p>
  <p>1 equipos registrados · inició 3 de mayo de 2024</p>
</header><table><thead><tr>
  <th>#</th><th>Equipo</th><th>✓</th><th title="20m por intento incorrecto antes del AC">Pen</th><th>A</th>
</tr></thead><tbody><tr>
  <td>1</td><td><p>Alpha</p><p>School Alpha</p></td><td>1</td><td>10</td><td>10</td>
</tr></tbody></table></body></html>`;

const createAcquisitionDependencies = async (
  root: string,
  eventPageHtml = eventHtml,
): Promise<{
  dependencies: AcquisitionDependencies;
  requestedUrls: string[];
  dispose: () => Promise<void>;
}> => {
  const cacheDirectory = await mkdtemp(path.join(root, 'cache-'));
  const bodies = new Map([
    ['https://www.icpcmexico.org/contests', discoveryHtml],
    ['https://www.icpcmexico.org/contests/gpmx-2024-fecha-1', eventPageHtml],
    ['https://www.icpcmexico.org/contests/gpmx-2024-fecha-1/scoreboard', scoreboardHtml],
  ]);
  const requestedUrls: string[] = [];
  const fetcher = {
    fetch: (url: string): Promise<SourceFetchResult> => {
      requestedUrls.push(url);
      const body = bodies.get(url);
      if (body === undefined) {
        return Promise.resolve({
          status: 'failed',
          sourceId: 'icpc-mexico',
          url,
          kind: 'http',
          message: 'Unexpected fixture URL.',
          httpStatus: 404,
        });
      }
      const bytes = new TextEncoder().encode(body);
      return Promise.resolve({
        status: 'fetched',
        sourceId: 'icpc-mexico',
        discoveryUrl: url,
        finalUrl: url,
        httpStatus: 200,
        contentType: 'text/html',
        body: bytes,
        contentSha256: createHash('sha256').update(bytes).digest('hex'),
        redirects: 0,
      });
    },
  } as unknown as BoundedSourceFetcher;
  return {
    dependencies: {
      cache: new BoundedJsonCache({
        directory: cacheDirectory,
        ttlMs: 60_000,
        maxEntries: 10,
        maxEntryBytes: 1024 * 1024,
      }),
      parse: () => Promise.reject(new Error('The adapter parser should handle this fixture.')),
      fetcherForSource: () => fetcher,
      now: () => new Date('2026-10-29T12:00:00Z'),
    },
    requestedUrls,
    dispose: () => rm(cacheDirectory, { recursive: true, force: true }),
  };
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

  it('acquires an ICPC Mexico scoreboard through bounded index and event discovery into a proposal', async () => {
    const root = await createRoot();
    const acquisition = await createAcquisitionDependencies(root);
    try {
      const result = await runStandingsIngestion(
        ['--acquire-icpc-mexico', '--season', '2024', '--stage', 'qualifier-1'],
        root,
        { acquisition: acquisition.dependencies },
      );
      const proposal = JSON.parse(await readFile(result.proposalPath, 'utf8')) as {
        status: string;
        candidates: { discoveryUrl: string; finalUrl: string; rows: unknown[] }[];
        sourceFailures: unknown[];
      };
      expect(result.status).toBe('complete');
      expect(proposal.candidates).toHaveLength(1);
      expect(proposal.candidates[0]).toMatchObject({
        discoveryUrl: 'https://www.icpcmexico.org/contests/gpmx-2024-fecha-1',
        finalUrl: 'https://www.icpcmexico.org/contests/gpmx-2024-fecha-1/scoreboard',
        rows: [expect.objectContaining({ teamName: 'Alpha', sourceTeamId: null })],
      });
      expect(proposal.sourceFailures).toEqual([]);
      expect(acquisition.requestedUrls).toEqual([
        'https://www.icpcmexico.org/contests',
        'https://www.icpcmexico.org/contests/gpmx-2024-fecha-1',
        'https://www.icpcmexico.org/contests/gpmx-2024-fecha-1/scoreboard',
      ]);
    } finally {
      await acquisition.dispose();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('requires a bounded season and rejects positional files in adapter acquisition mode', async () => {
    await expect(runStandingsIngestion(['--acquire-icpc-mexico'])).rejects.toThrow(
      '--acquire-icpc-mexico requires --season',
    );
    await expect(
      runStandingsIngestion(['--acquire-icpc-mexico', '--season', '2024', 'candidate.json']),
    ).rejects.toThrow('candidate JSON files');
  });

  it('writes an explicit failed proposal when scoreboard discovery is external', async () => {
    const root = await createRoot();
    const acquisition = await createAcquisitionDependencies(
      root,
      '<a href="https://example.com/scoreboard">Scoreboard</a>',
    );
    try {
      const result = await runStandingsIngestion(
        ['--acquire-icpc-mexico', '--season', '2024', '--stage', 'qualifier-1'],
        root,
        { acquisition: acquisition.dependencies },
      );
      const proposal = JSON.parse(await readFile(result.proposalPath, 'utf8')) as {
        status: string;
        candidates: unknown[];
        sourceFailures: { message: string }[];
      };
      expect(result.status).toBe('failed');
      expect(proposal.status).toBe('failed');
      expect(proposal.candidates).toEqual([]);
      expect(proposal.sourceFailures).toHaveLength(1);
      expect(proposal.sourceFailures[0].message).toContain(
        'scoreboard destination is outside ICPC Mexico',
      );
      expect(acquisition.requestedUrls).toHaveLength(2);
    } finally {
      await acquisition.dispose();
      await rm(root, { recursive: true, force: true });
    }
  });
});
