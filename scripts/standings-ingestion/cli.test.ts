import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { BoundedJsonCache } from './cache';
import { runStandingsIngestion } from './cli';
import { renderRequestSchema } from './render';

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

const sourceConfigurationWithITESO = {
  ...sourceConfiguration,
  sources: [
    ...sourceConfiguration.sources,
    {
      id: 'iteso',
      authorityId: 'iteso',
      name: 'ITESO ACM archive',
      baseUrl: 'https://eventos.iteso.mx/acm/',
      allowedOrigins: ['https://acm.iteso.mx'],
      supportedStages: [],
      supportsSeasonStanding: true,
    },
  ],
  preferredSeasonStandingSources: ['iteso'],
};

const sourceConfigurationWithICPCGlobal = {
  ...sourceConfiguration,
  sources: [
    ...sourceConfiguration.sources,
    {
      id: 'icpc-global-directory',
      authorityId: 'icpc-global',
      name: 'ICPC Global contest directory',
      baseUrl: 'https://icpc.global/regionals/contests',
      supportedStages: ['final'],
      supportsSeasonStanding: true,
    },
    {
      id: 'icpc-global-finder',
      authorityId: 'icpc-global',
      name: 'ICPC Global Mexico finder',
      baseUrl: 'https://icpc.global/regionals/finder/mexico',
      supportedStages: ['final'],
      supportsSeasonStanding: true,
    },
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
    { stage: 'final', sourceIds: ['icpc-global-finder', 'scorelatam'] },
  ],
  preferredSeasonStandingSources: ['icpc-global-directory'],
  editionMappings: [
    ...sourceConfiguration.editionMappings,
    { sourceId: 'icpc-global-directory', editionLabel: '2025-2026', seasonYear: 2025 },
    { sourceId: 'icpc-global-directory', editionLabel: '2026-2027', seasonYear: 2026 },
    { sourceId: 'icpc-global-finder', editionLabel: '2025', seasonYear: 2025 },
    { sourceId: 'icpc-global-finder', editionLabel: '2026', seasonYear: 2026 },
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

const icpcGlobalDirectoryHtml = `<!doctype html><html><body><table>
  <thead><tr><th>Contest</th><th>Registration</th><th>Standings</th></tr></thead>
  <tbody>
    <tr><td><a href="/regionals/finder/mcapgp-2026">The 2025 ICPC Gran Premio de Mexico</a></td><td>Closed</td><td><a href="https://www.icpcmexico.org/contests/gpmx-2025/acumulado">Results</a></td></tr>
    <tr><td><a href="/regionals/finder/Mexico-2026">The 2025 ICPC Mexico Finals</a></td><td>Closed</td><td><a href="https://scorelatam.naquadah.com.br/latam-2025/">Results</a></td></tr>
  </tbody>
</table></body></html>`;

const icpcGlobalDirectoryHtml2026 = `<!doctype html><html><body><table>
  <thead><tr><th>Contest</th><th>Registration</th><th>Standings</th></tr></thead>
  <tbody>
    <tr><td><a href="/regionals/finder/mcapgp-2027">The 2026 ICPC Gran Premio de Mexico</a></td><td>Open</td><td></td></tr>
    <tr><td><a href="/regionals/finder/Mexico-2027">The 2026 ICPC Mexico Finals</a></td><td>Upcoming</td><td></td></tr>
  </tbody>
</table></body></html>`;

const icpcGlobalCurrentFinderHtml = `<html><body><h1>The 2026 ICPC Mexico Finals</h1>
  <p>Upcoming Contest</p><a href="/regionals/finder/Mexico-2026">See Prior Year</a>
  <h2>Contest List</h2><a href="/regionals/finder/mcapgp-2027">The 2026 ICPC Gran Premio de Mexico</a>
</body></html>`;

const icpcGlobalCurrentFinderNoPriorHtml = `<html><body><h1>The 2026 ICPC Mexico Finals</h1>
  <p>Upcoming Contest</p><a href="/regionals/finder/Mexico-2027/standings">See Standings</a>
  <h2>Contest List</h2><a href="/regionals/finder/mcapgp-2027">The 2026 ICPC Gran Premio de Mexico</a>
</body></html>`;

const icpcGlobalGpmFinderNoStandingsHtml = `<html><body><h1>The 2026 ICPC Gran Premio de Mexico</h1>
  <p>Upcoming Contest</p>
</body></html>`;

const icpcGlobalMexicoFinderHtml = `<html><body><h1>The 2025 ICPC Mexico Finals</h1>
  <p>Past Contest</p><a href="/regionals/finder/Mexico-2026/standings">See Standings</a>
  <h2>Contest List</h2><a href="/regionals/finder/mcapgp-2026">The 2025 ICPC Gran Premio de Mexico</a>
  <a href="/regionals/finder/Mexico-2025">See Prior Year</a>
</body></html>`;

const icpcGlobalGpmFinderHtml = `<html><body><h1>The 2025 ICPC Gran Premio de Mexico</h1>
  <p>Past Contest</p><a href="/regionals/finder/mcapgp-2026/standings">See Standings</a>
  <a href="/regionals/finder/mcapgp-2025">See Prior Year</a>
</body></html>`;

const icpcGlobalStandingsHtml = `<html><body><main>
  <div>Standings for The 2025 ICPC Mexico Finals</div>
  <table><thead><tr><th>Place</th><th>Institution</th><th>Team</th><th>Problems Solved</th><th>Total Time</th><th>Last Solution</th><th>Citation</th></tr></thead>
  <tbody>
    <tr><td>1</td><td>School Alpha</td><td>Team Alpha</td><td>7</td><td>961</td><td>04:43</td><td></td></tr>
    <tr><td>2</td><td>School Beta</td><td>Team Beta</td><td>6</td><td>414</td><td>04:31</td><td></td></tr>
  </tbody></table><p>Rows per page: 1 - 2 of 2</p>
</main></body></html>`;

const icpcGlobalStandingsHtml2026 = `<html><body><main>
  <div>Standings for The 2026 ICPC Mexico Finals</div>
  <table><thead><tr><th>Place</th><th>Institution</th><th>Team</th><th>Problems Solved</th><th>Total Time</th><th>Last Solution</th></tr></thead>
  <tbody><tr><td>1</td><td>School Gamma</td><td>Team Gamma</td><td>3</td><td>120</td><td>02:00</td></tr></tbody></table>
  <p>Rows per page: 1000 1-1 of 1</p>
</main></body></html>`;

const icpcGlobalGpmStandingsHtml = `<html><body><main>
  <div>Standings for The 2025 ICPC Gran Premio de Mexico</div>
  <table><thead><tr><th>Place</th><th>Institution</th><th>Team</th><th>Problems Solved</th><th>Total Time</th><th>Last Solution</th></tr></thead>
  <tbody><tr><td>1</td><td>School Alpha</td><td>Team Alpha</td><td>20</td><td>200</td><td>05:00</td></tr></tbody></table>
  <p>Rows per page: 1 - 1 of 1</p>
</main></body></html>`;

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

const createRoot = async (configuration: unknown = sourceConfiguration): Promise<string> => {
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

  it('stages an ITESO PDF extraction with page evidence and does not request its thumbnail', async () => {
    const root = await createRoot(sourceConfigurationWithITESO);
    const archiveHtml = `<section><h2>ICPC México 2025</h2>
      <a href="/acm/resultados-acumulados-2025/">Resultado Acumulado del Gran Premio 2025</a>
    </section>`;
    const resultPageHtml = `<article><a href="http://acm.iteso.mx/share/result.pdf">
      <img src="https://i0.wp.com/acm.iteso.mx/share/preview.jpg"></a></article>`;
    const bodies = new Map<string, { body: Uint8Array; contentType: string }>([
      [
        'https://eventos.iteso.mx/acm/',
        { body: new TextEncoder().encode(archiveHtml), contentType: 'text/html' },
      ],
      [
        'https://eventos.iteso.mx/acm/resultados-acumulados-2025/',
        { body: new TextEncoder().encode(resultPageHtml), contentType: 'text/html' },
      ],
      [
        'https://acm.iteso.mx/share/result.pdf',
        {
          body: new TextEncoder().encode('%PDF-1.7 fixture'),
          contentType: 'application/octet-stream',
        },
      ],
    ]);
    const requestedUrls: string[] = [];
    const fetcher = {
      fetch: (url: string): Promise<SourceFetchResult> => {
        requestedUrls.push(url);
        const fixture = bodies.get(url);
        if (fixture === undefined) {
          return Promise.resolve({
            status: 'failed',
            sourceId: 'iteso',
            url,
            kind: 'invalid-url',
            message: 'Unexpected ITESO request.',
          });
        }
        return Promise.resolve({
          status: 'fetched',
          sourceId: 'iteso',
          discoveryUrl: url,
          finalUrl: url,
          httpStatus: 200,
          contentType: fixture.contentType,
          body: fixture.body,
          contentSha256: createHash('sha256').update(fixture.body).digest('hex'),
          redirects: 0,
        });
      },
    } as unknown as BoundedSourceFetcher;
    const cacheDirectory = await mkdtemp(path.join(root, 'iteso-cache-'));
    const document = {
      version: 1 as const,
      pageCount: 1,
      pages: [
        {
          pageNumber: 1,
          method: 'text' as const,
          text: 'Resultado acumulado',
          tables: [
            {
              rows: [
                {
                  cells: ['Lugar', 'Equipo', 'Puntos', 'Clasifica'],
                  confidences: [null, null, null, null],
                },
                {
                  cells: ['1', 'Equipo Alfa', '12.5', 'Sí'],
                  confidences: [null, null, null, null],
                },
              ],
            },
          ],
        },
      ],
    };
    try {
      const result = await runStandingsIngestion(
        ['--acquire-iteso', '--season', '2025', '--source', 'iteso'],
        root,
        {
          acquisition: {
            cache: new BoundedJsonCache({
              directory: cacheDirectory,
              ttlMs: 60_000,
              maxEntries: 10,
              maxEntryBytes: 1024 * 1024,
            }),
            parse: () => Promise.reject(new Error('ITESO uses its document extractor.')),
            fetcherForSource: () => fetcher,
          },
          itesoDocumentExtractor: (body, type) => {
            expect(new TextDecoder().decode(body)).toContain('%PDF-1.7');
            expect(type).toBe('pdf');
            return Promise.resolve(document);
          },
        },
      );
      const proposal = JSON.parse(await readFile(result.proposalPath, 'utf8')) as {
        status: string;
        candidates: unknown[];
        sourceFailures: { message: string }[];
      };
      expect(result.status).toBe('failed');
      expect(proposal.candidates).toEqual([]);
      expect(proposal.sourceFailures[0].message).toContain(
        'shared review-candidate contract does not yet support source-native season standings',
      );
      expect(requestedUrls).toEqual([
        'https://eventos.iteso.mx/acm/',
        'https://eventos.iteso.mx/acm/resultados-acumulados-2025/',
        'https://acm.iteso.mx/share/result.pdf',
      ]);
      const artifactReference = /staged at (\.standings-ingestion\/staged\/[^ ]+\.json)/.exec(
        proposal.sourceFailures[0].message,
      )?.[1];
      expect(artifactReference).toBeDefined();
      const artifact = JSON.parse(
        await readFile(path.join(root, artifactReference ?? ''), 'utf8'),
      ) as {
        documentType: string;
        originalAssetUrl: string;
        assetUrl: string;
        extraction: {
          status: string;
          scoreUnit: string;
          rows: { score: number; scoreText: string; qualified: boolean; pageNumber: number }[];
        };
      };
      expect(artifact).toMatchObject({
        documentType: 'pdf',
        originalAssetUrl: 'http://acm.iteso.mx/share/result.pdf',
        assetUrl: 'https://acm.iteso.mx/share/result.pdf',
        extraction: {
          status: 'ready',
          scoreUnit: 'Puntos',
          rows: [{ score: 12.5, scoreText: '12.5', qualified: true, pageNumber: 1 }],
        },
      });
    } finally {
      await rm(cacheDirectory, { recursive: true, force: true });
      await rm(root, { recursive: true, force: true });
    }
  });

  it('requires a single ITESO season and rejects contest-stage filters', async () => {
    await expect(runStandingsIngestion(['--acquire-iteso'])).rejects.toThrow(
      '--acquire-iteso requires --season',
    );
    await expect(
      runStandingsIngestion(['--acquire-iteso', '--season', '2025', '--stage', 'final']),
    ).rejects.toThrow('accumulated season standings, not contest stages');
  });

  it('traverses the ICPC Global directory and saved prior-year finder, then proposes complete Mexico Finals totals', async () => {
    const root = await createRoot(sourceConfigurationWithICPCGlobal);
    const cacheDirectory = await mkdtemp(path.join(root, 'icpc-global-cache-'));
    const bodies = new Map<string, string>([
      ['https://icpc.global/regionals/finder/mexico', icpcGlobalCurrentFinderHtml],
      ['https://icpc.global/regionals/finder/Mexico-2026', icpcGlobalMexicoFinderHtml],
      ['https://icpc.global/regionals/finder/mcapgp-2026', icpcGlobalGpmFinderHtml],
      ['https://scorelatam.naquadah.com.br/latam-2025/', scoreLATAMEditionHtml],
      [
        'https://www.icpcmexico.org/contests/gpmx-2025/acumulado',
        '<html><body><main><a href="/contests/gpmx-2025/score.pdf">Download results</a></main></body></html>',
      ],
      ['https://www.icpcmexico.org/contests/gpmx-2025/score.pdf', '%PDF-1.7 synthetic GPM'],
    ]);
    const requestedUrls: string[] = [];
    const renderCalls: { sourceId: string; url: string; actions: string[] }[] = [];
    const fetcher = {
      fetch: (url: string): Promise<SourceFetchResult> => {
        requestedUrls.push(url);
        const body = bodies.get(url);
        if (body === undefined) {
          return Promise.resolve({
            status: 'failed',
            sourceId: url.includes('icpcmexico.org') ? 'icpc-mexico' : 'icpc-global-finder',
            url,
            kind: 'http',
            message: 'Unexpected ICPC Global fixture URL.',
            httpStatus: 404,
          });
        }
        const bytes = new TextEncoder().encode(body);
        return Promise.resolve({
          status: 'fetched',
          sourceId: url.includes('icpcmexico.org') ? 'icpc-mexico' : 'icpc-global-finder',
          discoveryUrl: url,
          finalUrl: url,
          httpStatus: 200,
          contentType: url.endsWith('.pdf') ? 'application/pdf' : 'text/html',
          body: bytes,
          contentSha256: createHash('sha256').update(bytes).digest('hex'),
          redirects: 0,
        });
      },
    } as unknown as BoundedSourceFetcher;
    try {
      const result = await runStandingsIngestion(
        ['--acquire-icpc-global', '--season', '2025'],
        root,
        {
          acquisition: {
            cache: new BoundedJsonCache({
              directory: cacheDirectory,
              ttlMs: 60_000,
              maxEntries: 10,
              maxEntryBytes: 1024 * 1024,
            }),
            parse: () => Promise.reject(new Error('ICPC Global uses its source adapter.')),
            fetcherForSource: () => fetcher,
            render: (source, rawRequest) => {
              const request = renderRequestSchema.parse(rawRequest);
              renderCalls.push({
                sourceId: source.id,
                url: request.url,
                actions: request.actions.map((action) =>
                  'selector' in action
                    ? action.selector
                    : `${action.tableSelector}|${action.summarySelector}`,
                ),
              });
              const html =
                source.id === 'icpc-global-directory'
                  ? icpcGlobalDirectoryHtml
                  : request.url === 'https://icpc.global/regionals/finder/mexico'
                    ? icpcGlobalCurrentFinderHtml
                    : request.url.endsWith('/Mexico-2026')
                      ? icpcGlobalMexicoFinderHtml
                      : request.url.endsWith('/mcapgp-2026/standings')
                        ? icpcGlobalGpmStandingsHtml
                        : request.url.endsWith('/mcapgp-2026')
                          ? icpcGlobalGpmFinderHtml
                          : icpcGlobalStandingsHtml;
              const bytes = new TextEncoder().encode(html);
              return Promise.resolve({
                sourceId: source.id,
                discoveryUrl: request.url,
                finalUrl: request.url,
                capturedAt: '2026-10-30T12:00:00Z',
                html,
                contentSha256: createHash('sha256').update(bytes).digest('hex'),
                requests: 4,
              });
            },
            now: () => new Date('2026-10-30T12:00:00Z'),
          },
          itesoDocumentExtractor: (body, type) => {
            expect(type).toBe('pdf');
            expect(new TextDecoder().decode(body)).toContain('%PDF-1.7');
            return Promise.resolve({
              version: 1,
              pageCount: 1,
              pages: [
                {
                  pageNumber: 1,
                  method: 'text',
                  text: 'Resultado acumulado',
                  tables: [
                    {
                      rows: [
                        {
                          cells: ['Lugar', 'Equipo', 'Puntos', 'Clasifica'],
                          confidences: [null, null, null, null],
                        },
                        {
                          cells: ['1', 'Equipo Alfa', '12.5', 'Sí'],
                          confidences: [null, null, null, null],
                        },
                      ],
                    },
                  ],
                },
              ],
            });
          },
        },
      );
      const proposal = JSON.parse(await readFile(result.proposalPath, 'utf8')) as {
        status: string;
        candidates: {
          sourceId: string;
          sourceEditionLabel: string;
          contest: { seasonYear: number; seriesId: string; stage: string };
          rows: {
            place: number;
            teamName: string;
            schoolName: string;
            publishedTotals: { solved: number; penalty: number };
          }[];
        }[];
        sourceFailures: { message: string }[];
      };
      expect(result.status).toBe('partial');
      expect(proposal.candidates).toHaveLength(2);
      expect(proposal.candidates[0]).toMatchObject({
        sourceId: 'icpc-global-finder',
        sourceEditionLabel: '2025',
        contest: { seasonYear: 2025, seriesId: 'mexico-finals', stage: 'final' },
        rows: [
          {
            place: 1,
            teamName: 'Team Alpha',
            schoolName: 'School Alpha',
            publishedTotals: { solved: 7, penalty: 961 },
          },
          {
            place: 2,
            teamName: 'Team Beta',
            schoolName: 'School Beta',
            publishedTotals: { solved: 6, penalty: 414 },
          },
        ],
      });
      expect(proposal.candidates[1]).toMatchObject({
        sourceId: 'scorelatam',
        sourceEditionLabel: '2025',
        contest: { seasonYear: 2025, seriesId: 'mexico-finals', stage: 'final' },
      });
      expect(renderCalls.map(({ sourceId, url }) => `${sourceId}:${url}`)).toEqual([
        'icpc-global-directory:https://icpc.global/regionals/contests',
        'icpc-global-finder:https://icpc.global/regionals/finder/mexico',
        'icpc-global-finder:https://icpc.global/regionals/finder/Mexico-2026',
        'icpc-global-finder:https://icpc.global/regionals/finder/mcapgp-2026',
        'icpc-global-finder:https://icpc.global/regionals/finder/mcapgp-2026/standings',
        'icpc-global-finder:https://icpc.global/regionals/finder/Mexico-2026/standings',
      ]);
      expect(renderCalls[0].actions).toEqual([
        '[data-test="select_year"]',
        '[role="option"]:has-text("2025-2026")',
        'button:has-text("The 2025-2026 ICPC Latin America Contests")',
      ]);
      expect(requestedUrls).toEqual([
        'https://scorelatam.naquadah.com.br/latam-2025/',
        'https://www.icpcmexico.org/contests/gpmx-2025/acumulado',
        'https://www.icpcmexico.org/contests/gpmx-2025/score.pdf',
        'https://scorelatam.naquadah.com.br/latam-2025/',
      ]);
      expect(
        proposal.sourceFailures.some(({ message }) => message.includes('season-standing')),
      ).toBe(true);
      const artifactReference = /staged at (\.standings-ingestion\/staged\/[^ ]+\.json)/.exec(
        proposal.sourceFailures[0].message,
      )?.[1];
      expect(artifactReference).toBeDefined();
      const artifact = JSON.parse(
        await readFile(path.join(root, artifactReference ?? ''), 'utf8'),
      ) as {
        cycleLabel: string;
        finderHistory: { discovery: { editionYear: number } }[];
        gpmStandingsResults: unknown[];
        finalAlternativeResults: {
          sourceId: string;
          extraction: { status: string };
        }[];
        primaryFinalStandingsCapture: { html: string } | null;
      };
      expect(artifact).toMatchObject({
        cycleLabel: '2025-2026',
        finderHistory: [{ discovery: { editionYear: 2026 } }, { discovery: { editionYear: 2025 } }],
      });
      expect(artifact.gpmStandingsResults).toHaveLength(2);
      expect(artifact.finalAlternativeResults).toMatchObject([
        { sourceId: 'scorelatam', extraction: { status: 'ready' } },
      ]);
      expect(artifact.primaryFinalStandingsCapture?.html).toContain(
        'Standings for The 2025 ICPC Mexico Finals',
      );
    } finally {
      await rm(cacheDirectory, { recursive: true, force: true });
      await rm(root, { recursive: true, force: true });
    }
  });

  it('stops at the current Mexico Finals edition when no prior year exists', async () => {
    const root = await createRoot(sourceConfigurationWithICPCGlobal);
    const cacheDirectory = await mkdtemp(path.join(root, 'icpc-global-current-cache-'));
    const bodies = new Map([
      ['https://icpc.global/regionals/finder/mcapgp-2027', icpcGlobalGpmFinderNoStandingsHtml],
    ]);
    const requestedUrls: string[] = [];
    const renderCalls: string[] = [];
    const fetcher = {
      fetch: (url: string): Promise<SourceFetchResult> => {
        requestedUrls.push(url);
        const body = bodies.get(url);
        if (body === undefined) {
          return Promise.resolve({
            status: 'failed',
            sourceId: 'icpc-global-finder',
            url,
            kind: 'http',
            message: 'Unexpected current-edition fixture URL.',
            httpStatus: 404,
          });
        }
        const bytes = new TextEncoder().encode(body);
        return Promise.resolve({
          status: 'fetched',
          sourceId: 'icpc-global-finder',
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
    try {
      const result = await runStandingsIngestion(
        ['--acquire-icpc-global', '--season', '2026'],
        root,
        {
          acquisition: {
            cache: new BoundedJsonCache({
              directory: cacheDirectory,
              ttlMs: 60_000,
              maxEntries: 10,
              maxEntryBytes: 1024 * 1024,
            }),
            parse: () => Promise.reject(new Error('ICPC Global uses its source adapter.')),
            fetcherForSource: () => fetcher,
            render: (source, rawRequest) => {
              const request = renderRequestSchema.parse(rawRequest);
              renderCalls.push(`${source.id}:${request.url}`);
              const html =
                source.id === 'icpc-global-directory'
                  ? icpcGlobalDirectoryHtml2026
                  : request.url.endsWith('/mcapgp-2027')
                    ? icpcGlobalGpmFinderNoStandingsHtml
                    : request.url.endsWith('/Mexico-2027/standings')
                      ? icpcGlobalStandingsHtml2026
                      : icpcGlobalCurrentFinderNoPriorHtml;
              const bytes = new TextEncoder().encode(html);
              return Promise.resolve({
                sourceId: source.id,
                discoveryUrl: request.url,
                finalUrl: request.url,
                capturedAt: '2026-10-30T12:00:00Z',
                html,
                contentSha256: createHash('sha256').update(bytes).digest('hex'),
                requests: 4,
              });
            },
          },
        },
      );
      const proposal = JSON.parse(await readFile(result.proposalPath, 'utf8')) as {
        status: string;
        candidates: { sourceId: string; contest: { seasonYear: number }; rows: unknown[] }[];
      };
      expect(result.status).toBe('partial');
      expect(proposal.candidates).toHaveLength(1);
      expect(proposal.candidates[0]).toMatchObject({
        sourceId: 'icpc-global-finder',
        contest: { seasonYear: 2026 },
        rows: [{ place: 1, teamName: 'Team Gamma' }],
      });
      expect(renderCalls).toEqual([
        'icpc-global-directory:https://icpc.global/regionals/contests',
        'icpc-global-finder:https://icpc.global/regionals/finder/mexico',
        'icpc-global-finder:https://icpc.global/regionals/finder/mcapgp-2027',
        'icpc-global-finder:https://icpc.global/regionals/finder/Mexico-2027/standings',
      ]);
      expect(requestedUrls).toEqual([]);
    } finally {
      await rm(cacheDirectory, { recursive: true, force: true });
      await rm(root, { recursive: true, force: true });
    }
  });

  it('requires an explicit ICPC Global cycle mapping before rendering', async () => {
    const root = await createRoot(sourceConfigurationWithICPCGlobal);
    try {
      const result = await runStandingsIngestion(
        ['--acquire-icpc-global', '--season', '2024'],
        root,
      );
      const proposal = JSON.parse(await readFile(result.proposalPath, 'utf8')) as {
        status: string;
        sourceFailures: { message: string }[];
      };
      expect(result.status).toBe('failed');
      expect(proposal.sourceFailures[0].message).toContain(
        'has no matching reviewed edition mapping',
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('fails closed when the ICPC Global sources are not configured', async () => {
    const root = await createRoot();
    try {
      await expect(
        runStandingsIngestion(['--acquire-icpc-global', '--season', '2025'], root),
      ).rejects.toThrow('Both ICPC Global directory and finder sources must be configured');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('stages an unfamiliar rendered directory without starting finder traversal', async () => {
    const root = await createRoot(sourceConfigurationWithICPCGlobal);
    const cacheDirectory = await mkdtemp(path.join(root, 'icpc-global-directory-error-'));
    try {
      const renderCalls: string[] = [];
      const result = await runStandingsIngestion(
        ['--acquire-icpc-global', '--season', '2025'],
        root,
        {
          acquisition: {
            cache: new BoundedJsonCache({
              directory: cacheDirectory,
              ttlMs: 60_000,
              maxEntries: 10,
              maxEntryBytes: 1024 * 1024,
            }),
            parse: () => Promise.reject(new Error('ICPC Global uses its source adapter.')),
            render: (source, rawRequest) => {
              const request = renderRequestSchema.parse(rawRequest);
              renderCalls.push(source.id);
              const html = '<html><body><main>Directory layout changed</main></body></html>';
              const bytes = new TextEncoder().encode(html);
              return Promise.resolve({
                sourceId: source.id,
                discoveryUrl: request.url,
                finalUrl: request.url,
                capturedAt: '2026-10-30T12:00:00Z',
                html,
                contentSha256: createHash('sha256').update(bytes).digest('hex'),
                requests: 4,
              });
            },
          },
        },
      );
      const proposal = JSON.parse(await readFile(result.proposalPath, 'utf8')) as {
        status: string;
        candidates: unknown[];
        sourceFailures: { message: string }[];
      };
      expect(result.status).toBe('failed');
      expect(proposal.candidates).toEqual([]);
      expect(proposal.sourceFailures[0].message).toContain('directory discovery requires review');
      expect(renderCalls).toEqual(['icpc-global-directory']);
    } finally {
      await rm(cacheDirectory, { recursive: true, force: true });
      await rm(root, { recursive: true, force: true });
    }
  });

  it('requires one ICPC Global season and reports a bounded directory-render failure', async () => {
    await expect(runStandingsIngestion(['--acquire-icpc-global'])).rejects.toThrow(
      '--acquire-icpc-global requires --season',
    );
    await expect(
      runStandingsIngestion([
        '--acquire-icpc-global',
        '--season',
        '2025',
        '--source',
        'icpc-global-finder',
      ]),
    ).rejects.toThrow('collects the directory and finder together');
    await expect(
      runStandingsIngestion(['--acquire-icpc-global', '--season', '2025', '--stage', 'final']),
    ).rejects.toThrow('acquires Mexico Finals and GPM discovery together');

    const root = await createRoot(sourceConfigurationWithICPCGlobal);
    const cacheDirectory = await mkdtemp(path.join(root, 'icpc-global-render-error-'));
    try {
      const result = await runStandingsIngestion(
        ['--acquire-icpc-global', '--season', '2025'],
        root,
        {
          acquisition: {
            cache: new BoundedJsonCache({
              directory: cacheDirectory,
              ttlMs: 60_000,
              maxEntries: 10,
              maxEntryBytes: 1024 * 1024,
            }),
            parse: () => Promise.reject(new Error('ICPC Global uses its source adapter.')),
            render: () => Promise.reject(new Error('blocked by source policy')),
          },
        },
      );
      const proposal = JSON.parse(await readFile(result.proposalPath, 'utf8')) as {
        status: string;
        sourceFailures: { message: string }[];
      };
      expect(result.status).toBe('failed');
      expect(proposal.sourceFailures[0].message).toContain(
        'Could not render ICPC Global cycle 2025-2026: blocked by source policy',
      );
    } finally {
      await rm(cacheDirectory, { recursive: true, force: true });
      await rm(root, { recursive: true, force: true });
    }
  });

  it('stops and reports a repeated ICPC Global prior-year URL', async () => {
    const root = await createRoot(sourceConfigurationWithICPCGlobal);
    const cacheDirectory = await mkdtemp(path.join(root, 'icpc-global-loop-cache-'));
    const loopHtml = `<html><body><h1>The 2026 ICPC Mexico Finals</h1>
      <a href="/regionals/finder/mexico">See Prior Year</a>
      <a href="/regionals/finder/mcapgp-2027">The 2026 ICPC Gran Premio de Mexico</a>
    </body></html>`;
    const requestedUrls: string[] = [];
    const renderedUrls: string[] = [];
    const fetcher = {
      fetch: (url: string): Promise<SourceFetchResult> => {
        requestedUrls.push(url);
        const bytes = new TextEncoder().encode(loopHtml);
        return Promise.resolve({
          status: 'fetched',
          sourceId: 'icpc-global-finder',
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
    try {
      const result = await runStandingsIngestion(
        ['--acquire-icpc-global', '--season', '2025'],
        root,
        {
          acquisition: {
            cache: new BoundedJsonCache({
              directory: cacheDirectory,
              ttlMs: 60_000,
              maxEntries: 10,
              maxEntryBytes: 1024 * 1024,
            }),
            parse: () => Promise.reject(new Error('ICPC Global uses its source adapter.')),
            fetcherForSource: () => fetcher,
            render: (source, rawRequest) => {
              const request = renderRequestSchema.parse(rawRequest);
              renderedUrls.push(request.url);
              const html =
                source.id === 'icpc-global-directory' ? icpcGlobalDirectoryHtml : loopHtml;
              const bytes = new TextEncoder().encode(html);
              return Promise.resolve({
                sourceId: source.id,
                discoveryUrl: request.url,
                finalUrl: request.url,
                capturedAt: '2026-10-30T12:00:00Z',
                html,
                contentSha256: createHash('sha256').update(bytes).digest('hex'),
                requests: 4,
              });
            },
          },
        },
      );
      const proposal = JSON.parse(await readFile(result.proposalPath, 'utf8')) as {
        status: string;
        sourceFailures: { message: string }[];
      };
      expect(result.status).toBe('failed');
      expect(proposal.sourceFailures[0].message).toContain('prior-year navigation repeated');
      expect(renderedUrls).toEqual([
        'https://icpc.global/regionals/contests',
        'https://icpc.global/regionals/finder/mexico',
      ]);
      expect(requestedUrls).toEqual([]);
    } finally {
      await rm(cacheDirectory, { recursive: true, force: true });
      await rm(root, { recursive: true, force: true });
    }
  });
});
