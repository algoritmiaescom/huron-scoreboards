import { randomUUID } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';

import { identityAliasRegistrySchema } from '@/features/scoreboards/ingestion/identities';
import {
  reviewProposalSchema,
  sourceConfigurationSchema,
} from '@/features/scoreboards/ingestion/schemas';
import { contestStageSchema, seasonYearSchema } from '@/features/scoreboards/model/schemas';
import { createJsonScoreboardsRepository } from '@/features/scoreboards/repositories/scoreboardsRepository';

import { acquireStandingsBatch } from './acquire';
import {
  discoverICPCMexicoIndex,
  discoverICPCMexicoScoreboard,
  parseICPCMexicoScoreboard,
} from './adapters/icpc-mexico';
import { BoundedJsonCache } from './cache';
import { BoundedSourceFetcher } from './fetch';
import { createReviewProposal, writeProposalAtomically } from './operator';

import type { AcquisitionDependencies, AcquisitionRequest } from './acquire';
import type { ICPCMexicoDiscovery } from './adapters/icpc-mexico';
import type { SourceFetchResult } from './fetch';
import type { JsonFiles } from '@/lib/data/repository';

const MAX_CANDIDATE_FILES = 100;
const MAX_INPUT_BYTES = 64 * 1024 * 1024;
const MAX_TOTAL_CANDIDATE_BYTES = 256 * 1024 * 1024;
const MAX_CANDIDATE_RECORDS = 1000;
const MAX_ICPC_MEXICO_JOBS = 20;
const MAX_ICPC_MEXICO_BACKFILL_YEARS = 5;

interface CliOptions {
  acquireICPCMexico: boolean;
  sourceId?: string;
  seasonYear?: number;
  seasonYears?: number[];
  seriesId?: string;
  stage?: string;
  outputDirectory: string;
  candidateFiles: string[];
}

export interface StandingsIngestionCliDependencies {
  acquisition?: AcquisitionDependencies;
}

const parseCliOptions = (argv: string[]): CliOptions => {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      'acquire-icpc-mexico': { type: 'boolean', default: false },
      source: { type: 'string' },
      season: { type: 'string' },
      'season-from': { type: 'string' },
      'season-to': { type: 'string' },
      series: { type: 'string' },
      stage: { type: 'string' },
      'output-dir': { type: 'string', default: '.standings-ingestion/proposals' },
    },
  });
  const acquireICPCMexico = values['acquire-icpc-mexico'];
  if (
    (acquireICPCMexico && positionals.length !== 0) ||
    (!acquireICPCMexico && (positionals.length === 0 || positionals.length > MAX_CANDIDATE_FILES))
  ) {
    throw new Error(`Provide between 1 and ${String(MAX_CANDIDATE_FILES)} candidate JSON files.`);
  }
  let seasonYear: number | undefined;
  if (values.season !== undefined) {
    const parsedYear = seasonYearSchema.safeParse(Number(values.season));
    if (!parsedYear.success) {
      throw new Error('--season must be an integer between 1990 and 2100.');
    }
    seasonYear = parsedYear.data;
  }
  const hasSeasonFrom = values['season-from'] !== undefined;
  const hasSeasonTo = values['season-to'] !== undefined;
  let seasonYears: number[] | undefined;
  if (hasSeasonFrom || hasSeasonTo) {
    if (!hasSeasonFrom || !hasSeasonTo || seasonYear !== undefined) {
      throw new Error(
        '--season-from and --season-to must be provided together, instead of --season.',
      );
    }
    const parsedFrom = seasonYearSchema.safeParse(Number(values['season-from']));
    const parsedTo = seasonYearSchema.safeParse(Number(values['season-to']));
    if (!parsedFrom.success || !parsedTo.success || parsedFrom.data > parsedTo.data) {
      throw new Error('--season-from and --season-to must be valid ascending season years.');
    }
    const yearCount = parsedTo.data - parsedFrom.data + 1;
    if (yearCount > MAX_ICPC_MEXICO_BACKFILL_YEARS) {
      throw new Error(
        `ICPC Mexico backfill ranges are limited to ${String(MAX_ICPC_MEXICO_BACKFILL_YEARS)} seasons.`,
      );
    }
    seasonYears = Array.from({ length: yearCount }, (_, index) => parsedFrom.data + index);
  } else if (seasonYear !== undefined) {
    seasonYears = [seasonYear];
  }
  if (values.stage !== undefined && !contestStageSchema.safeParse(values.stage).success) {
    throw new Error('--stage must be a supported contest stage.');
  }
  if (acquireICPCMexico && seasonYear === undefined) {
    if (seasonYears === undefined) {
      throw new Error(
        '--acquire-icpc-mexico requires --season or a bounded --season-from/--season-to range.',
      );
    }
  }
  if (!acquireICPCMexico && (hasSeasonFrom || hasSeasonTo)) {
    throw new Error('--season-from/--season-to are only supported with --acquire-icpc-mexico.');
  }
  if (acquireICPCMexico && values.source !== undefined && values.source !== 'icpc-mexico') {
    throw new Error('--acquire-icpc-mexico only supports --source icpc-mexico.');
  }
  return {
    acquireICPCMexico,
    ...(values.source === undefined ? {} : { sourceId: values.source }),
    ...(seasonYear === undefined ? {} : { seasonYear }),
    ...(seasonYears === undefined ? {} : { seasonYears }),
    ...(values.series === undefined ? {} : { seriesId: values.series }),
    ...(values.stage === undefined ? {} : { stage: values.stage }),
    outputDirectory: values['output-dir'],
    candidateFiles: positionals,
  };
};

const readBoundedJson = async (filePath: string): Promise<unknown> => {
  const fileStats = await stat(filePath);
  if (!fileStats.isFile() || fileStats.size > MAX_INPUT_BYTES) {
    throw new Error(`Input file exceeds the ${String(MAX_INPUT_BYTES)} byte limit: ${filePath}`);
  }
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
};

const loadCandidateFiles = async (files: readonly string[]): Promise<unknown[]> => {
  const candidates: unknown[] = [];
  let totalBytes = 0;
  for (const file of files) {
    const fileStats = await stat(file);
    if (!fileStats.isFile() || fileStats.size > MAX_INPUT_BYTES) {
      throw new Error(`Candidate file exceeds the ${String(MAX_INPUT_BYTES)} byte limit: ${file}`);
    }
    totalBytes += fileStats.size;
    if (totalBytes > MAX_TOTAL_CANDIDATE_BYTES) {
      throw new Error(
        `Candidate inputs exceed the ${String(MAX_TOTAL_CANDIDATE_BYTES)} byte run limit.`,
      );
    }
    const value = JSON.parse(await readFile(file, 'utf8')) as unknown;
    if (Array.isArray(value)) {
      for (const candidate of value as unknown[]) {
        candidates.push(candidate);
      }
    } else {
      candidates.push(value);
    }
    if (candidates.length > MAX_CANDIDATE_RECORDS) {
      throw new Error(
        `Candidate input exceeds the ${String(MAX_CANDIDATE_RECORDS)} record run limit.`,
      );
    }
  }
  return candidates;
};

const textFromFetch = async (
  fetcher: BoundedSourceFetcher,
  url: string,
): Promise<Extract<SourceFetchResult, { status: 'fetched' }> | string> => {
  const result = await fetcher.fetch(url);
  return result.status === 'fetched' ? result : `${result.kind}: ${result.message}`;
};

const icpcMexicoAcquisition = async (
  configuration: ReturnType<typeof sourceConfigurationSchema.parse>,
  options: CliOptions,
  root: string,
  injectedDependencies?: AcquisitionDependencies,
) => {
  const source = configuration.sources.find(({ id }) => id === 'icpc-mexico');
  if (source === undefined) {
    throw new Error('ICPC Mexico source is not configured.');
  }
  const fetcher =
    injectedDependencies?.fetcherForSource?.(configuration, source.id) ??
    new BoundedSourceFetcher(source, {
      timeoutMs: 20_000,
      maxResponseBytes: 32 * 1024 * 1024,
      maxRequests: MAX_ICPC_MEXICO_JOBS + 1,
      maxRedirects: 3,
    });
  const discoveryUrl = source.baseUrl;
  const indexResult = await textFromFetch(fetcher, discoveryUrl);
  if (typeof indexResult === 'string') {
    return {
      candidates: [],
      sourceFailures: [
        {
          sourceId: source.id,
          contest: null,
          message: `Could not fetch ICPC Mexico contest index: ${indexResult}`,
        },
      ],
    };
  }

  const selectedContests = discoverICPCMexicoIndex(
    new TextDecoder().decode(indexResult.body),
  ).discoveries.filter(
    (
      discovery,
    ): discovery is Extract<ICPCMexicoDiscovery, { status: 'recognized'; kind: 'contest' }> =>
      discovery.status === 'recognized' &&
      discovery.kind === 'contest' &&
      options.seasonYears?.includes(discovery.seasonYear) === true &&
      (options.seriesId === undefined || discovery.seriesId === options.seriesId) &&
      (options.stage === undefined || discovery.stage === options.stage),
  );
  if (selectedContests.length === 0) {
    return {
      candidates: [],
      sourceFailures: [
        {
          sourceId: source.id,
          contest: null,
          message: `No recognized ICPC Mexico contests matched season ${String(options.seasonYear)} and the requested filters.`,
        },
      ],
    };
  }

  const sourceFailures: {
    sourceId: string;
    contest: { seasonYear: number; seriesId: string; stage: string } | null;
    message: string;
  }[] = [];
  const requests: AcquisitionRequest[] = [];
  for (const [index, contest] of selectedContests.entries()) {
    const contestKey = {
      seasonYear: contest.seasonYear,
      seriesId: contest.seriesId,
      stage: contest.stage,
    };
    if (index >= MAX_ICPC_MEXICO_JOBS) {
      sourceFailures.push({
        sourceId: source.id,
        contest: null,
        message: `ICPC Mexico acquisition limit of ${String(MAX_ICPC_MEXICO_JOBS)} contests was reached.`,
      });
      break;
    }
    const eventResult = await textFromFetch(fetcher, contest.url);
    if (typeof eventResult === 'string') {
      sourceFailures.push({
        sourceId: source.id,
        contest: contestKey,
        message: `Could not fetch contest page: ${eventResult}`,
      });
      continue;
    }
    const scoreboard = discoverICPCMexicoScoreboard(
      new TextDecoder().decode(eventResult.body),
      contest.url,
    );
    if (scoreboard.status !== 'found') {
      sourceFailures.push({
        sourceId: source.id,
        contest: contestKey,
        message:
          scoreboard.status === 'missing'
            ? 'Contest page has no scoreboard destination.'
            : `Scoreboard destination requires review: ${scoreboard.stagedLinks.map(({ reason, url }) => `${reason} (${url})`).join('; ')}`,
      });
      continue;
    }
    const context = {
      seasonYear: contest.seasonYear,
      seriesId: contest.seriesId,
      stage: contest.stage,
      sourceEditionLabel: contest.sourceEditionLabel,
      publicationState: contest.publicationState,
    };
    requests.push({
      configuration,
      sourceId: source.id,
      ...contestKey,
      discoveryUrl: contest.url,
      content: { kind: 'fetch', url: scoreboard.scoreboardUrl },
      parserVersion: 'icpc-mexico-scoreboard-v1',
      promptVersion: null,
      model: null,
      options: { adapter: 'icpc-mexico', ...context },
      parse: (body) =>
        Promise.resolve(parseICPCMexicoScoreboard(new TextDecoder().decode(body), context)),
    });
  }

  if (requests.length === 0) {
    return { candidates: [], sourceFailures };
  }
  const acquisitionDependencies: AcquisitionDependencies = injectedDependencies ?? {
    cache: new BoundedJsonCache({
      directory: path.join(root, '.standings-ingestion/cache'),
      ttlMs: 7 * 24 * 60 * 60 * 1000,
      maxEntries: 1000,
      maxEntryBytes: 32 * 1024 * 1024,
    }),
    parse: () =>
      Promise.reject(new Error('ICPC Mexico parser was not assigned to its acquisition job.')),
  };
  const batch = await acquireStandingsBatch(requests, acquisitionDependencies);
  return {
    candidates: batch.candidates,
    sourceFailures: [
      ...sourceFailures,
      ...batch.sourceFailures.map((failure) => ({
        ...failure,
        contest: failure.contest,
      })),
    ],
  };
};

const loadArchiveFiles = async (root: string): Promise<JsonFiles> => {
  const files: JsonFiles = {};
  const dataDirectory = path.join(root, 'data');
  const schoolsFile = path.join(dataDirectory, 'schools.json');
  try {
    await stat(schoolsFile);
    files['data/schools.json'] = () => readFile(schoolsFile, 'utf8');
  } catch {
    // An empty real archive may not have a schools registry yet.
  }
  const seasonsDirectory = path.join(dataDirectory, 'seasons');
  let seasons;
  try {
    seasons = await readdir(seasonsDirectory, { withFileTypes: true });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return files;
    }
    throw error;
  }
  for (const season of seasons.filter((entry) => entry.isDirectory())) {
    const seasonDirectory = path.join(seasonsDirectory, season.name);
    const seasonPath = `data/seasons/${season.name}`;
    for (const entry of await readdir(seasonDirectory, { withFileTypes: true })) {
      const entryPath = path.join(seasonDirectory, entry.name);
      if (entry.isFile() && entry.name === 'teams.json') {
        files[`${seasonPath}/teams.json`] = () => readFile(entryPath, 'utf8');
        continue;
      }
      if (!entry.isDirectory()) {
        continue;
      }
      for (const dataFile of await readdir(entryPath, { withFileTypes: true })) {
        if (dataFile.isFile() && dataFile.name.endsWith('.json')) {
          const absolutePath = path.join(entryPath, dataFile.name);
          files[`${seasonPath}/${entry.name}/${dataFile.name}`] = () =>
            readFile(absolutePath, 'utf8');
        }
      }
    }
  }
  return files;
};

export const runStandingsIngestion = async (
  argv: string[],
  root = process.cwd(),
  dependencies: StandingsIngestionCliDependencies = {},
): Promise<{ proposalPath: string; status: string }> => {
  const options = parseCliOptions(argv);
  const candidates = options.acquireICPCMexico
    ? []
    : await loadCandidateFiles(options.candidateFiles);
  const [sourceConfiguration, identityRegistry] = await Promise.all([
    readBoundedJson(path.join(root, 'config/standings-sources.json')),
    readBoundedJson(path.join(root, 'config/standings-identities.json')),
  ]);
  const parsedConfiguration = sourceConfigurationSchema.parse(sourceConfiguration);
  const parsedAliases = identityAliasRegistrySchema.parse(identityRegistry);
  const acquisition = options.acquireICPCMexico
    ? await icpcMexicoAcquisition(parsedConfiguration, options, root, dependencies.acquisition)
    : { candidates: [], sourceFailures: [] };
  const archiveResult = await createJsonScoreboardsRepository(
    await loadArchiveFiles(root),
    'archive',
  ).load();
  if (archiveResult.status === 'invalid' || archiveResult.status === 'error') {
    throw new Error(`Published archive did not validate: ${JSON.stringify(archiveResult.issues)}`);
  }
  const runId = `run-${String(Date.now())}-${randomUUID()}`;
  const baseProposal = createReviewProposal({
    archive: archiveResult.data,
    candidates: [...candidates, ...acquisition.candidates],
    sourceConfiguration: parsedConfiguration,
    identityAliases: parsedAliases.aliases,
    selection: {
      ...(options.sourceId === undefined ? {} : { sourceId: options.sourceId }),
      ...(options.seasonYear === undefined ? {} : { seasonYear: options.seasonYear }),
      ...(options.seriesId === undefined ? {} : { seriesId: options.seriesId }),
      ...(options.stage === undefined ? {} : { stage: options.stage }),
    },
    runId,
    generatedAt: new Date().toISOString(),
  });
  const proposal = reviewProposalSchema.parse({
    ...baseProposal,
    status:
      acquisition.sourceFailures.length === 0
        ? baseProposal.status
        : baseProposal.candidates.length === 0
          ? 'failed'
          : 'partial',
    sourceFailures: [...baseProposal.sourceFailures, ...acquisition.sourceFailures],
  });
  const proposalPath = await writeProposalAtomically(
    path.resolve(root, options.outputDirectory),
    `${runId}.json`,
    proposal,
  );
  return { proposalPath, status: proposal.status };
};
