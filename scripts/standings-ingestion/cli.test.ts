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
  editionMappings: [
    { sourceId: 'icpc-mexico', editionLabel: '2023', seasonYear: 2023 },
    { sourceId: 'icpc-mexico', editionLabel: '2024', seasonYear: 2024 },
  ],
};

const sourceConfigurationWithScoreLATAM = {
  ...sourceConfiguration,
  sources: [
    ...sourceConfiguration.sources,
    {
      id: 'scorelatam',
      authorityId: 'scorelatam',
      name: 'ScoreLATAM',
      baseUrl: 'https://scorelatam.naquadah.com.br/',
      supportedStages: ['final'],
      supportsSeasonStanding: false,
    },
  ],
  preferredSources: [
    ...sourceConfiguration.preferredSources,
    { stage: 'final', sourceIds: ['scorelatam'] },
  ],
};

const sourceConfigurationWithMappedScoreLATAM = {
  ...sourceConfigurationWithScoreLATAM,
  editionMappings: [
    ...sourceConfiguration.editionMappings,
    { sourceId: 'scorelatam', editionLabel: '2025', seasonYear: 2025 },
  ],
};

const identityRegistry = { schemaVersion: 1, aliases: [] };

const scoreLATAMIndexHtml = `<!doctype html><html><body>
  <h2>PdA - Programadores de America</h2><a href="/pda25/">2025</a>
  <h2>LATAM</h2><a href="/latam-2025/">2025</a>
</body></html>`;

const scoreLATAMEditionHtml = `<!doctype html><html><body>
  <a onclick="toggleGroup(1)">Global</a><a onclick="toggleGroup(17)">Mexico</a>
  <a onclick="toggleGroup(28)">CCL</a><a onclick="toggleGroup(33)">Mexico</a>
  <h2>Final Scoreboard</h2>
  <table id="myscoretable"><tbody>
    <tr><td>#</td><td>User/Site</td><td>Name</td><td>A</td><td>Total</td></tr>
    <tr class="sitegroup1"><td>10</td><td>teammxmx006 /MX</td><td>[School Alpha] Alpha</td><td>3/144</td><td>1 (184)</td></tr>
    <tr class="sitegroup17" style="display:none"><td>1</td><td>teammxmx006 /MX</td><td>[School Alpha] Alpha</td><td>3/144</td><td>1 (184)</td></tr>
  </tbody></table>
</body></html>`;

const discoveryHtml = `<!doctype html><html><body>
  <h2>Temporada 2024</h2>
  <a href="/contests/gpmx-2024-fecha-1">Primera Fecha</a>
  <h2>Temporada 2023</h2>
  <a href="/contests/gpmx-2023-fecha-1">Primera Fecha</a>
</body></html>`;

const backfillOverflowDiscoveryHtml = `<html><body>${Array.from({ length: 5 }, (_, yearIndex) => {
  const year = 2020 + yearIndex;
  const stages = [
    ['fecha-0', 'Fecha 0'],
    ['fecha-1', 'Primera Fecha'],
    ['fecha-2', 'Segunda Fecha'],
    ['fecha-3', 'Tercera Fecha'],
    ['repechaje', 'Repechaje'],
  ];
  return `<h2>Temporada ${String(year)}</h2>${stages
    .map(([stage, label]) => `<a href="/contests/gpmx-${String(year)}-${stage}">${label}</a>`)
    .join('')}`;
}).join('')}</body></html>`;

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

const eventHtml2023 =
  '<header><p>Gran Premio MX 2023 — Primera Fecha</p></header><a href="/contests/gpmx-2023-fecha-1/scoreboard">Vista solo scoreboard</a>';

const scoreboardHtml2023 = scoreboardHtml.replaceAll('2024', '2023');

const createAcquisitionDependencies = async (
  root: string,
  eventPageHtml = eventHtml,
  indexPageHtml = discoveryHtml,
): Promise<{
  dependencies: AcquisitionDependencies;
  requestedUrls: string[];
  dispose: () => Promise<void>;
}> => {
  const cacheDirectory = await mkdtemp(path.join(root, 'cache-'));
  const bodies = new Map([
    ['https://www.icpcmexico.org/contests', indexPageHtml],
    ['https://www.icpcmexico.org/contests/gpmx-2024-fecha-1', eventPageHtml],
    ['https://www.icpcmexico.org/contests/gpmx-2024-fecha-1/scoreboard', scoreboardHtml],
    ['https://www.icpcmexico.org/contests/gpmx-2023-fecha-1', eventHtml2023],
    ['https://www.icpcmexico.org/contests/gpmx-2023-fecha-1/scoreboard', scoreboardHtml2023],
  ]);
  const requestedUrls: string[] = [];
  const fetcher = {
    fetch: (url: string): Promise<SourceFetchResult> => {
      requestedUrls.push(url);
      const body = bodies.get(url) ?? fixtureBodyForDiscoveredUrl(url);
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

const createScoreLATAMAcquisitionDependencies = async (
  root: string,
): Promise<{
  dependencies: AcquisitionDependencies;
  requestedUrls: string[];
  dispose: () => Promise<void>;
}> => {
  const cacheDirectory = await mkdtemp(path.join(root, 'scorelatam-cache-'));
  const bodies = new Map([
    ['https://scorelatam.naquadah.com.br/', scoreLATAMIndexHtml],
    ['https://scorelatam.naquadah.com.br/latam-2025/', scoreLATAMEditionHtml],
  ]);
  const requestedUrls: string[] = [];
  const fetcher = {
    fetch: (url: string): Promise<SourceFetchResult> => {
      requestedUrls.push(url);
      const body = bodies.get(url);
      if (body === undefined) {
        return Promise.resolve({
          status: 'failed',
          sourceId: 'scorelatam',
          url,
          kind: 'http',
          message: 'Unexpected ScoreLATAM fixture URL.',
          httpStatus: 404,
        });
      }
      const bytes = new TextEncoder().encode(body);
      return Promise.resolve({
        status: 'fetched',
        sourceId: 'scorelatam',
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
      parse: () => Promise.reject(new Error('ScoreLATAM extraction uses its source adapter.')),
      fetcherForSource: () => fetcher,
      now: () => new Date('2026-10-29T12:00:00Z'),
    },
    requestedUrls,
    dispose: () => rm(cacheDirectory, { recursive: true, force: true }),
  };
};

const fixtureBodyForDiscoveredUrl = (url: string): string | undefined => {
  const parsedUrl = new URL(url);
  const eventMatch = /^\/contests\/(gpmx-(\d{4})-(?:fecha-[0-3]|repechaje))$/.exec(
    parsedUrl.pathname,
  );
  if (eventMatch !== null) {
    return `<header><p>Gran Premio MX ${eventMatch[2]}</p></header><a href="${url}/scoreboard">Vista solo scoreboard</a>`;
  }
  const scoreboardMatch = /^\/contests\/gpmx-\d{4}-(?:fecha-[0-3]|repechaje)\/scoreboard$/.exec(
    parsedUrl.pathname,
  );
  if (scoreboardMatch === null) {
    return undefined;
  }
  const seasonYear = /gpmx-(\d{4})/.exec(parsedUrl.pathname)?.[1] ?? '2024';
  return scoreboardHtml.replaceAll('2024', seasonYear);
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

const createRoot = async (configuration = sourceConfiguration): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), 'huron-standings-cli-'));
  await mkdir(path.join(root, 'config'), { recursive: true });
  await writeFile(path.join(root, 'config/standings-sources.json'), JSON.stringify(configuration));
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

  it('acquires an inclusive multi-season backfill within one bounded run', async () => {
    const root = await createRoot();
    const acquisition = await createAcquisitionDependencies(root);
    try {
      const result = await runStandingsIngestion(
        ['--acquire-icpc-mexico', '--season-from', '2023', '--season-to', '2024'],
        root,
        { acquisition: acquisition.dependencies },
      );
      const proposal = JSON.parse(await readFile(result.proposalPath, 'utf8')) as {
        candidates: { contest: { seasonYear: number } }[];
      };
      expect(result.status).toBe('complete');
      expect(proposal.candidates.map(({ contest }) => contest.seasonYear)).toEqual([2023, 2024]);
      expect(acquisition.requestedUrls).toHaveLength(5);
    } finally {
      await acquisition.dispose();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('records overflow and fetches no more than 20 contests across a five-season backfill', async () => {
    const stages = ['fecha-0', 'qualifier-1', 'qualifier-2', 'qualifier-3', 'repechage'];
    const boundedConfiguration = {
      ...sourceConfiguration,
      sources: sourceConfiguration.sources.map((source) => ({
        ...source,
        supportedStages: stages,
      })),
      preferredSources: stages.map((stage) => ({ stage, sourceIds: ['icpc-mexico'] })),
      editionMappings: Array.from({ length: 5 }, (_, index) => ({
        sourceId: 'icpc-mexico',
        editionLabel: String(2020 + index),
        seasonYear: 2020 + index,
      })),
    };
    const root = await createRoot(boundedConfiguration);
    const acquisition = await createAcquisitionDependencies(
      root,
      eventHtml,
      backfillOverflowDiscoveryHtml,
    );
    try {
      const result = await runStandingsIngestion(
        ['--acquire-icpc-mexico', '--season-from', '2020', '--season-to', '2024'],
        root,
        { acquisition: acquisition.dependencies },
      );
      const proposal = JSON.parse(await readFile(result.proposalPath, 'utf8')) as {
        status: string;
        candidates: unknown[];
        sourceFailures: { message: string }[];
      };
      const eventRequests = acquisition.requestedUrls.filter((url) =>
        /gpmx-\d{4}-(?:fecha-[0-3]|repechaje)$/.test(new URL(url).pathname),
      );
      const scoreboardRequests = acquisition.requestedUrls.filter((url) =>
        url.endsWith('/scoreboard'),
      );
      expect(result.status).toBe('partial');
      expect(proposal.candidates).toHaveLength(20);
      expect(eventRequests).toHaveLength(20);
      expect(scoreboardRequests).toHaveLength(20);
      expect(proposal.sourceFailures).toContainEqual(
        expect.objectContaining({
          message: 'ICPC Mexico acquisition limit of 20 contests was reached.',
        }),
      );
      expect(acquisition.requestedUrls).toHaveLength(41);
    } finally {
      await acquisition.dispose();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('bounds season ranges and rejects incomplete or reversed bounds before acquisition', async () => {
    await expect(runStandingsIngestion(['--acquire-icpc-mexico'])).rejects.toThrow(
      '--acquire-icpc-mexico requires --season or a bounded',
    );
    await expect(
      runStandingsIngestion(['--acquire-icpc-mexico', '--season-from', '2023']),
    ).rejects.toThrow('--season-from and --season-to must be provided together');
    await expect(
      runStandingsIngestion([
        '--acquire-icpc-mexico',
        '--season-from',
        '2024',
        '--season-to',
        '2023',
      ]),
    ).rejects.toThrow('valid ascending season years');
    await expect(
      runStandingsIngestion([
        '--acquire-icpc-mexico',
        '--season-from',
        '2020',
        '--season-to',
        '2025',
      ]),
    ).rejects.toThrow('limited to 5 seasons');
    await expect(
      runStandingsIngestion(['--season-from', '2023', '--season-to', '2024', 'candidate.json']),
    ).rejects.toThrow('only supported with --acquire-icpc-mexico');
    await expect(
      runStandingsIngestion([
        '--acquire-icpc-mexico',
        '--season',
        '2023',
        '--season-from',
        '2023',
        '--season-to',
        '2024',
      ]),
    ).rejects.toThrow('provided together, instead of --season');
    await expect(
      runStandingsIngestion([
        '--acquire-icpc-mexico',
        '--season-from',
        '2023',
        '--season-to',
        '2024',
        'candidate.json',
      ]),
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

  it('stages the reviewed ScoreLATAM extraction without emitting a candidate when its edition is unmapped', async () => {
    const root = await createRoot(sourceConfigurationWithScoreLATAM);
    const acquisition = await createScoreLATAMAcquisitionDependencies(root);
    try {
      const result = await runStandingsIngestion(
        ['--acquire-scorelatam', '--season', '2025', '--source', 'scorelatam'],
        root,
        { acquisition: acquisition.dependencies },
      );
      const proposal = JSON.parse(await readFile(result.proposalPath, 'utf8')) as {
        status: string;
        candidates: unknown[];
        additions: unknown[];
        sourceFailures: { message: string }[];
      };
      expect(result.status).toBe('failed');
      expect(proposal.candidates).toEqual([]);
      expect(proposal.additions).toEqual([]);
      expect(proposal.sourceFailures).toHaveLength(1);
      expect(proposal.sourceFailures[0].message).toContain('has no reviewed season mapping');
      const artifactReference = /staged at (\.standings-ingestion\/staged\/[^.]+\.json)/.exec(
        proposal.sourceFailures[0].message,
      )?.[1];
      expect(artifactReference).toBeDefined();
      const artifact = JSON.parse(
        await readFile(path.join(root, artifactReference ?? ''), 'utf8'),
      ) as {
        eventEquivalence: string;
        extraction: {
          status: string;
          rows: { mexicoPlace: number; latamPlace: number; sourceUserSite: string }[];
        };
      };
      expect(artifact).toMatchObject({
        eventEquivalence: 'reviewer-approved',
        extraction: {
          status: 'ready',
          rows: [{ mexicoPlace: 1, latamPlace: 10, sourceUserSite: 'teammxmx006/MX' }],
        },
      });
      expect(acquisition.requestedUrls).toEqual([
        'https://scorelatam.naquadah.com.br/',
        'https://scorelatam.naquadah.com.br/latam-2025/',
        'https://scorelatam.naquadah.com.br/latam-2025/',
      ]);
    } finally {
      await acquisition.dispose();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('converts an edition-mapped ScoreLATAM Mexico group into a final-stage candidate', async () => {
    const root = await createRoot(sourceConfigurationWithMappedScoreLATAM);
    const acquisition = await createScoreLATAMAcquisitionDependencies(root);
    try {
      const result = await runStandingsIngestion(
        ['--acquire-scorelatam', '--season', '2025', '--stage', 'final'],
        root,
        { acquisition: acquisition.dependencies },
      );
      const proposal = JSON.parse(await readFile(result.proposalPath, 'utf8')) as {
        status: string;
        candidates: {
          contest: {
            seasonYear: number;
            seriesId: string;
            stage: string;
            publicationState: string;
          };
          rows: { place: number; sourceTeamId: string | null; evidence: { field: string }[] }[];
          warnings: string[];
        }[];
        additions: unknown[];
      };
      expect(result.status).toBe('complete');
      expect(proposal.candidates).toHaveLength(1);
      const candidate = proposal.candidates[0];
      expect(candidate.contest).toMatchObject({
        seasonYear: 2025,
        seriesId: 'mexico-finals',
        stage: 'final',
        publicationState: 'final',
      });
      expect(candidate.rows[0].place).toBe(1);
      expect(candidate.rows[0].sourceTeamId).toBe('teammxmx006');
      const evidenceFields = candidate.rows[0].evidence.map(({ field }) => field);
      expect(evidenceFields).toContain('rows[0].place');
      expect(evidenceFields).toContain('rows[0].latamPlace');
      expect(
        candidate.warnings.some((warning) =>
          warning.includes('Mexico-local places are used for the approved Mexico Finals mapping'),
        ),
      ).toBe(true);
      expect(proposal.additions).toEqual([]);
    } finally {
      await acquisition.dispose();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('requires an explicit ScoreLATAM edition and refuses unreviewed series mapping arguments', async () => {
    await expect(runStandingsIngestion(['--acquire-scorelatam'])).rejects.toThrow(
      '--acquire-scorelatam requires --season',
    );
    await expect(
      runStandingsIngestion(['--acquire-scorelatam', '--season', '2025', '--series', 'gpm']),
    ).rejects.toThrow('--acquire-scorelatam only supports --series mexico-finals');
  });
});
