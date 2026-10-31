import { randomUUID } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';

import { identityAliasRegistrySchema } from '@/features/scoreboards/ingestion/identities';
import {
  reviewProposalSchema,
  seasonStandingCandidateSchema,
  sourceConfigurationSchema,
} from '@/features/scoreboards/ingestion/schemas';
import { contestStageSchema, seasonYearSchema } from '@/features/scoreboards/model/schemas';
import { createJsonScoreboardsRepository } from '@/features/scoreboards/repositories/scoreboardsRepository';

import { acquireStandingsBatch } from './acquire';
import {
  classifyICPCGlobalDocument,
  deduplicateICPCGlobalDestinations,
  discoverICPCGlobalDirectory,
  discoverICPCGlobalFinder,
  discoverICPCGlobalStandingsLink,
  parseICPCGlobalStandings,
} from './adapters/icpc-global';
import {
  discoverICPCMexicoIndex,
  discoverICPCMexicoScoreboard,
  parseICPCMexicoScoreboard,
} from './adapters/icpc-mexico';
import {
  detectITESODocumentType,
  discoverITESOAccumulatedPage,
  discoverITESOArchive,
  discoverITESOResultAsset,
} from './adapters/iteso';
import { parseITESOAccumulatedDocument } from './adapters/iteso-document';
import { discoverScoreLATAMEditions, parseScoreLATAMMexicoScoreboard } from './adapters/scorelatam';
import { BoundedJsonCache } from './cache';
import { BoundedSourceFetcher } from './fetch';
import { extractITESODocument } from './iteso-document-extractor';
import { createReviewProposal, writeJsonAtomically, writeProposalAtomically } from './operator';
import { renderRequestSchema, renderSelectedSourceState } from './render';

import type {
  AcquisitionDependencies,
  AcquisitionRequest,
  SourceCandidatePayload,
} from './acquire';
import type {
  ICPCGlobalFinderDiscovery,
  ICPCGlobalStandingsExtraction,
} from './adapters/icpc-global';
import type { ICPCMexicoDiscovery } from './adapters/icpc-mexico';
import type { ITESOAccumulatedExtraction } from './adapters/iteso-document';
import type { ScoreLATAMEdition, ScoreLATAMMexicoScoreboard } from './adapters/scorelatam';
import type { SourceFetchResult } from './fetch';
import type { ITESOExtractedDocument } from './iteso-document-extractor';
import type { RenderedSourceState, RenderLimits, RenderRequest } from './render';
import type { JsonFiles } from '@/lib/data/repository';

const MAX_CANDIDATE_FILES = 100;
const MAX_INPUT_BYTES = 64 * 1024 * 1024;
const MAX_TOTAL_CANDIDATE_BYTES = 256 * 1024 * 1024;
const MAX_CANDIDATE_RECORDS = 1000;
const MAX_ICPC_MEXICO_JOBS = 20;
const MAX_ICPC_MEXICO_BACKFILL_YEARS = 5;
const MAX_ICPC_GLOBAL_PRIOR_YEARS = 20;

interface CliOptions {
  acquireICPCMexico: boolean;
  acquireScoreLATAM: boolean;
  acquireITESO: boolean;
  acquireICPCGlobal: boolean;
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
  itesoDocumentExtractor?: (
    body: Uint8Array,
    type: 'pdf' | 'image',
    repositoryRoot: string,
  ) => Promise<ITESOExtractedDocument>;
}

const parseCliOptions = (argv: string[]): CliOptions => {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      'acquire-icpc-mexico': { type: 'boolean', default: false },
      'acquire-scorelatam': { type: 'boolean', default: false },
      'acquire-iteso': { type: 'boolean', default: false },
      'acquire-icpc-global': { type: 'boolean', default: false },
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
  const acquireScoreLATAM = values['acquire-scorelatam'];
  const acquireITESO = values['acquire-iteso'];
  const acquireICPCGlobal = values['acquire-icpc-global'];
  const acquisitionModes = [
    acquireICPCMexico,
    acquireScoreLATAM,
    acquireITESO,
    acquireICPCGlobal,
  ].filter(Boolean);
  if (acquisitionModes.length > 1) {
    throw new Error('Choose only one source-specific acquisition mode per run.');
  }
  const acquireSource = acquisitionModes.length === 1;
  if (
    (acquireSource && positionals.length !== 0) ||
    (!acquireSource && (positionals.length === 0 || positionals.length > MAX_CANDIDATE_FILES))
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
  if ((!acquireICPCMexico || acquireScoreLATAM) && (hasSeasonFrom || hasSeasonTo)) {
    throw new Error('--season-from/--season-to are only supported with --acquire-icpc-mexico.');
  }
  if (acquireICPCMexico && values.source !== undefined && values.source !== 'icpc-mexico') {
    throw new Error('--acquire-icpc-mexico only supports --source icpc-mexico.');
  }
  if (acquireScoreLATAM && values.source !== undefined && values.source !== 'scorelatam') {
    throw new Error('--acquire-scorelatam only supports --source scorelatam.');
  }
  if (acquireScoreLATAM && seasonYear === undefined) {
    throw new Error('--acquire-scorelatam requires --season to select one LATAM edition.');
  }
  if (acquireITESO && seasonYear === undefined) {
    throw new Error('--acquire-iteso requires --season to select one ITESO edition.');
  }
  if (acquireICPCGlobal && seasonYear === undefined) {
    throw new Error('--acquire-icpc-global requires --season to select one Mexican edition.');
  }
  if (acquireScoreLATAM && values.series !== undefined && values.series !== 'mexico-finals') {
    throw new Error('--acquire-scorelatam only supports --series mexico-finals.');
  }
  if (acquireScoreLATAM && values.stage !== undefined && values.stage !== 'final') {
    throw new Error('--acquire-scorelatam only supports --stage final.');
  }
  if (acquireITESO && values.source !== undefined && values.source !== 'iteso') {
    throw new Error('--acquire-iteso only supports --source iteso.');
  }
  if (acquireITESO && (values.series !== undefined || values.stage !== undefined)) {
    throw new Error('--acquire-iteso extracts accumulated season standings, not contest stages.');
  }
  if (acquireICPCGlobal && values.source !== undefined) {
    throw new Error(
      '--acquire-icpc-global collects the directory and finder together; omit --source.',
    );
  }
  if (acquireICPCGlobal && (values.series !== undefined || values.stage !== undefined)) {
    throw new Error('--acquire-icpc-global acquires Mexico Finals and GPM discovery together.');
  }
  return {
    acquireICPCMexico,
    acquireScoreLATAM,
    acquireITESO,
    acquireICPCGlobal,
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

const fetchFromConfiguredOrigin = async (
  targetUrl: string,
  configuration: ReturnType<typeof sourceConfigurationSchema.parse>,
  dependencies?: AcquisitionDependencies,
) => {
  const target = new URL(targetUrl);
  const source = configuration.sources.find(({ baseUrl, allowedOrigins }) => {
    const origins = [
      new URL(baseUrl).origin,
      ...(allowedOrigins ?? []).map((origin) => new URL(origin).origin),
    ];
    return origins.includes(target.origin);
  });
  if (source === undefined) {
    return null;
  }
  const fetcher =
    dependencies?.fetcherForSource?.(configuration, source.id) ??
    new BoundedSourceFetcher(source, {
      timeoutMs: 20_000,
      maxResponseBytes: 32 * 1024 * 1024,
      maxRequests: 5,
      maxRedirects: 3,
    });
  return { source, result: await fetcher.fetch(target.href) };
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

const scoreLATAMCandidatePayload = (
  extraction: ScoreLATAMMexicoScoreboard,
  stagedArtifactPath: string,
): SourceCandidatePayload => {
  if (extraction.status !== 'ready') {
    throw new Error(extraction.reason ?? 'ScoreLATAM Mexico extraction requires review.');
  }
  return {
    sourceEditionLabel: extraction.sourceEditionLabel,
    contest: {
      seasonYear: extraction.editionYear,
      seriesId: 'mexico-finals',
      stage: 'final',
      name: `ScoreLATAM Mexico ${String(extraction.editionYear)} local standings`,
      publicationState: extraction.publicationState,
      date: null,
      durationMinutes: null,
      penaltyMinutesPerFailedAttempt: null,
      problemLabels: extraction.problemLabels.map((label) => label.toUpperCase()),
    },
    rows: extraction.rows.map((row, rowIndex) => {
      const sourceEvidence = (field: string) =>
        row.evidence.find((evidence) => evidence.field === `rows[${String(rowIndex)}].${field}`);
      const remapEvidence = (sourceField: string, candidateField: string) => {
        const evidence = sourceEvidence(sourceField);
        return evidence === undefined ? [] : [{ ...evidence, field: candidateField }];
      };
      return {
        place: row.mexicoPlace,
        sourceTeamId: row.sourceTeamId,
        teamName: row.teamName,
        sourceSchoolId: null,
        schoolName: row.schoolName,
        results: row.results,
        publishedTotals: row.publishedTotals,
        evidence: [
          ...row.evidence.filter(({ excerpt }) => excerpt.trim().length > 0),
          ...remapEvidence('mexicoPlace', `rows[${String(rowIndex)}].place`),
          ...remapEvidence('sourceUserSite', `rows[${String(rowIndex)}].sourceTeamId`),
          ...remapEvidence('name', `rows[${String(rowIndex)}].teamName`),
          ...(row.schoolName === null
            ? []
            : remapEvidence('name', `rows[${String(rowIndex)}].schoolName`)),
          ...remapEvidence('publishedTotals', `rows[${String(rowIndex)}].publishedTotals.solved`),
          ...remapEvidence('publishedTotals', `rows[${String(rowIndex)}].publishedTotals.penalty`),
        ],
      };
    }),
    coverage: {
      expectedRowCount: null,
      rowsComplete: extraction.coverage.rowsComplete,
      paginationComplete: extraction.coverage.paginationComplete,
    },
    warnings: [
      ...extraction.warnings,
      `Full source extraction is staged at ${stagedArtifactPath}.`,
      'Mexico-local places are used for the approved Mexico Finals mapping; global LATAM places remain source evidence only.',
      'Contest name is a normalized adapter label because the source names the full LATAM contest, not a separate Mexico final.',
    ],
  };
};

const scoreLATAMAcquisition = async (
  configuration: ReturnType<typeof sourceConfigurationSchema.parse>,
  options: CliOptions,
  root: string,
  injectedDependencies?: AcquisitionDependencies,
) => {
  const source = configuration.sources.find(({ id }) => id === 'scorelatam');
  if (source === undefined) {
    throw new Error('ScoreLATAM source is not configured.');
  }
  const fetcher =
    injectedDependencies?.fetcherForSource?.(configuration, source.id) ??
    new BoundedSourceFetcher(source, {
      timeoutMs: 20_000,
      maxResponseBytes: 32 * 1024 * 1024,
      maxRequests: 3,
      maxRedirects: 2,
    });
  const indexResult = await textFromFetch(fetcher, source.baseUrl);
  if (typeof indexResult === 'string') {
    return {
      candidates: [],
      sourceFailures: [
        {
          sourceId: source.id,
          contest: null,
          message: `Could not fetch ScoreLATAM edition index: ${indexResult}`,
        },
      ],
    };
  }
  const index = discoverScoreLATAMEditions(new TextDecoder().decode(indexResult.body));
  const editions = index.editions.filter(({ editionYear }) => editionYear === options.seasonYear);
  if (editions.length !== 1) {
    return {
      candidates: [],
      sourceFailures: [
        {
          sourceId: source.id,
          contest: null,
          message: `Expected one ScoreLATAM LATAM edition ${String(options.seasonYear)}, found ${String(editions.length)}.`,
        },
      ],
    };
  }

  const edition = editions[0];
  const scoreboardResponse = await textFromFetch(fetcher, edition.url);
  if (typeof scoreboardResponse === 'string') {
    return {
      candidates: [],
      sourceFailures: [
        {
          sourceId: source.id,
          contest: null,
          message: `Could not fetch ScoreLATAM edition ${String(edition.editionYear)}: ${scoreboardResponse}`,
        },
      ],
    };
  }
  const extraction = parseScoreLATAMMexicoScoreboard(
    new TextDecoder().decode(scoreboardResponse.body),
    edition,
  );
  const artifactName = `run-${String(Date.now())}-${randomUUID()}-scorelatam-${String(edition.editionYear)}.json`;
  const artifactPath = await writeJsonAtomically(
    path.join(root, '.standings-ingestion/staged'),
    artifactName,
    {
      schemaVersion: 1,
      sourceId: source.id,
      authorityId: source.authorityId,
      discoveryUrl: source.baseUrl,
      finalUrl: scoreboardResponse.finalUrl,
      retrievedAt: new Date().toISOString(),
      discoveryContentSha256: indexResult.contentSha256,
      contentSha256: scoreboardResponse.contentSha256,
      parserVersion: 'scorelatam-mexico-scoregroup-v2',
      eventEquivalence: extraction.eventEquivalence,
      extraction,
    },
  );
  const relativeArtifactPath = path.relative(root, artifactPath);
  if (extraction.status === 'staged') {
    return {
      candidates: [],
      sourceFailures: [
        {
          sourceId: source.id,
          contest: null,
          message: `ScoreLATAM extraction staged at ${relativeArtifactPath}: ${extraction.reason ?? 'Mexico group extraction requires review.'}`,
        },
      ],
    };
  }

  const contestRequest: AcquisitionRequest = {
    configuration,
    sourceId: source.id,
    seasonYear: edition.editionYear,
    seriesId: 'mexico-finals',
    stage: 'final',
    discoveryUrl: source.baseUrl,
    content: { kind: 'fetch', url: edition.url },
    parserVersion: 'scorelatam-mexico-scoregroup-v2',
    promptVersion: null,
    model: null,
    options: {
      adapter: 'scorelatam-mexico-scoregroup-v2',
      sourceEditionLabel: edition.sourceEditionLabel,
      eventEquivalence: 'reviewer-approved',
    },
    parse: (body) => {
      const parsedExtraction = parseScoreLATAMMexicoScoreboard(
        new TextDecoder().decode(body),
        edition,
      );
      if (parsedExtraction.status !== 'ready') {
        return Promise.reject(
          new Error(parsedExtraction.reason ?? 'ScoreLATAM Mexico extraction requires review.'),
        );
      }
      return Promise.resolve(scoreLATAMCandidatePayload(parsedExtraction, relativeArtifactPath));
    },
  };
  const defaultAcquisitionDependencies: AcquisitionDependencies = {
    cache: new BoundedJsonCache({
      directory: path.join(root, '.standings-ingestion/cache'),
      ttlMs: 7 * 24 * 60 * 60 * 1000,
      maxEntries: 1000,
      maxEntryBytes: 32 * 1024 * 1024,
    }),
    parse: () =>
      Promise.reject(new Error('ScoreLATAM parser was not assigned to its acquisition job.')),
  };
  const baseAcquisitionDependencies = injectedDependencies ?? defaultAcquisitionDependencies;
  const acquisitionDependencies: AcquisitionDependencies = {
    ...baseAcquisitionDependencies,
    fetcherForSource: () => fetcher,
  };
  const batch = await acquireStandingsBatch([contestRequest], acquisitionDependencies);
  return {
    candidates: batch.candidates,
    sourceFailures: [
      ...batch.sourceFailures.map((failure) => ({
        ...failure,
        message: `${failure.message}; ScoreLATAM extraction staged at ${relativeArtifactPath}.`,
      })),
    ],
  };
};

const itesoAcquisition = async (
  configuration: ReturnType<typeof sourceConfigurationSchema.parse>,
  options: CliOptions,
  root: string,
  dependencies: StandingsIngestionCliDependencies,
) => {
  const source = configuration.sources.find(({ id }) => id === 'iteso');
  if (source === undefined) {
    throw new Error('ITESO source is not configured.');
  }
  const seasonYear = options.seasonYear;
  if (seasonYear === undefined) {
    throw new Error('ITESO acquisition requires a selected season.');
  }
  const fetcher =
    dependencies.acquisition?.fetcherForSource?.(configuration, source.id) ??
    new BoundedSourceFetcher(source, {
      timeoutMs: 20_000,
      maxResponseBytes: 32 * 1024 * 1024,
      maxRequests: 5,
      maxRedirects: 3,
    });
  const sourceFailure = (message: string) => ({
    candidates: [],
    seasonStandingCandidates: [],
    sourceFailures: [{ sourceId: source.id, contest: null, message }],
  });
  const indexResult = await fetcher.fetch(source.baseUrl);
  if (indexResult.status !== 'fetched') {
    return sourceFailure(
      `Could not fetch ITESO archive index: ${indexResult.kind}: ${indexResult.message}`,
    );
  }
  const index = discoverITESOArchive(new TextDecoder().decode(indexResult.body));
  const editions = index.editions.filter((edition) => edition.seasonYear === seasonYear);
  if (editions.length !== 1) {
    return sourceFailure(
      `Expected one ITESO archive entry for season ${String(seasonYear)}, found ${String(editions.length)}.`,
    );
  }
  const edition = editions[0];
  let accumulatedPageUrl = edition.accumulatedPageUrl;
  if (accumulatedPageUrl === null) {
    if (edition.overviewUrl === null) {
      const stagedReason = edition.stagedLinks.map(({ reason }) => reason).join('; ');
      return sourceFailure(
        `ITESO season ${String(seasonYear)} has no discovered overview or accumulated result${stagedReason.length === 0 ? '.' : `: ${stagedReason}`}`,
      );
    }
    const overviewResult = await fetcher.fetch(edition.overviewUrl);
    if (overviewResult.status !== 'fetched') {
      return sourceFailure(
        `Could not fetch ITESO season ${String(seasonYear)} overview: ${overviewResult.kind}: ${overviewResult.message}`,
      );
    }
    const pageDiscovery = discoverITESOAccumulatedPage(
      new TextDecoder().decode(overviewResult.body),
      overviewResult.finalUrl,
      seasonYear,
    );
    if (pageDiscovery.status !== 'found') {
      return sourceFailure(
        pageDiscovery.status === 'missing'
          ? `ITESO season ${String(seasonYear)} has no accumulated result page.`
          : `ITESO accumulated result link requires review: ${pageDiscovery.stagedLinks.map(({ reason, url }) => `${reason} (${url})`).join('; ')}`,
      );
    }
    accumulatedPageUrl = pageDiscovery.accumulatedPageUrl;
  }

  const resultPageResponse = await fetcher.fetch(accumulatedPageUrl);
  if (resultPageResponse.status !== 'fetched') {
    return sourceFailure(
      `Could not fetch ITESO season ${String(seasonYear)} result page: ${resultPageResponse.kind}: ${resultPageResponse.message}`,
    );
  }
  const allowedOrigins = source.allowedOrigins ?? [];
  const resultAsset = discoverITESOResultAsset(
    new TextDecoder().decode(resultPageResponse.body),
    resultPageResponse.finalUrl,
    allowedOrigins,
  );
  if (resultAsset.status !== 'found') {
    return sourceFailure(
      resultAsset.status === 'missing'
        ? `ITESO season ${String(seasonYear)} result page has no linked document.`
        : `ITESO result asset requires review: ${resultAsset.candidates.map(({ reason, url }) => `${reason} (${url})`).join('; ')}`,
    );
  }

  let asset = resultAsset;
  let documentResponse = await fetcher.fetch(asset.assetUrl);
  if (documentResponse.status !== 'fetched') {
    return sourceFailure(
      `Could not fetch ITESO result asset: ${documentResponse.kind}: ${documentResponse.message}`,
    );
  }
  let dispatch = detectITESODocumentType(documentResponse.contentType, documentResponse.body);
  if (dispatch.type === 'html') {
    const nestedAsset = discoverITESOResultAsset(
      new TextDecoder().decode(documentResponse.body),
      documentResponse.finalUrl,
      allowedOrigins,
    );
    if (nestedAsset.status !== 'found' || nestedAsset.assetUrl === asset.assetUrl) {
      return sourceFailure(
        'ITESO result asset resolved to HTML without one approved document link.',
      );
    }
    asset = nestedAsset;
    documentResponse = await fetcher.fetch(asset.assetUrl);
    if (documentResponse.status !== 'fetched') {
      return sourceFailure(
        `Could not fetch nested ITESO result document: ${documentResponse.kind}: ${documentResponse.message}`,
      );
    }
    dispatch = detectITESODocumentType(documentResponse.contentType, documentResponse.body);
  }
  if (dispatch.type !== 'pdf' && dispatch.type !== 'image') {
    return sourceFailure(
      `ITESO result destination is not a recognized PDF or image (detected ${dispatch.type}).`,
    );
  }

  let extractedDocument: ITESOExtractedDocument | null = null;
  let extractionError: string | null = null;
  try {
    extractedDocument = await (dependencies.itesoDocumentExtractor ?? extractITESODocument)(
      documentResponse.body,
      dispatch.type,
      root,
    );
  } catch (error) {
    extractionError = error instanceof Error ? error.message : 'Local PDF/OCR extraction failed.';
  }
  const snapshotLabel = [
    asset.linkText,
    ...(extractedDocument?.pages ?? []).map(({ text }) => text.slice(0, 2000)),
  ].join(' ');
  const extraction =
    extractedDocument === null
      ? null
      : parseITESOAccumulatedDocument(extractedDocument.pages, snapshotLabel);
  const artifactPath = await writeJsonAtomically(
    path.join(root, '.standings-ingestion/staged'),
    `run-${String(Date.now())}-${randomUUID()}-iteso-${String(seasonYear)}.json`,
    {
      schemaVersion: 1,
      sourceId: source.id,
      authorityId: source.authorityId,
      seasonYear,
      editionLabel: edition.editionLabel,
      discoveryUrl: source.baseUrl,
      accumulatedPageUrl,
      resultPageFinalUrl: resultPageResponse.finalUrl,
      originalAssetUrl: asset.originalUrl,
      assetUrl: documentResponse.finalUrl,
      thumbnailUrl: asset.thumbnailUrl,
      retrievedAt: new Date().toISOString(),
      discoveryContentSha256: indexResult.contentSha256,
      contentSha256: documentResponse.contentSha256,
      contentType: dispatch.declaredContentType,
      documentType: dispatch.type,
      signatureMatched: dispatch.signatureMatched,
      redirects: documentResponse.redirects,
      extractionError,
      extractedDocument,
      extraction,
      archiveDuplicateOverviewUrls: index.duplicateOverviewUrls,
    },
  );
  const relativeArtifactPath = path.relative(root, artifactPath);
  if (extractionError !== null || extraction === null || extractedDocument === null) {
    return sourceFailure(
      `ITESO season ${String(seasonYear)} document staged at ${relativeArtifactPath}: ${extractionError ?? 'document extraction did not produce parsed rows'}`,
    );
  }
  if (extraction.status === 'staged') {
    return sourceFailure(
      `ITESO season ${String(seasonYear)} document staged at ${relativeArtifactPath}: ${extraction.reason}`,
    );
  }
  const seasonStandingCandidate = seasonStandingCandidateSchema.parse({
    candidateId: `iteso-gpm-${String(seasonYear)}-${documentResponse.contentSha256.slice(0, 12)}`,
    sourceId: source.id,
    authorityId: source.authorityId,
    discoveryUrl: source.baseUrl,
    finalUrl: documentResponse.finalUrl,
    retrievedAt: new Date().toISOString(),
    contentSha256: documentResponse.contentSha256,
    parserVersion: 'iteso-season-standing-v1',
    sourceEditionLabel: edition.editionLabel,
    seasonYear,
    seriesId: 'gpm',
    snapshot: extraction.snapshot,
    scoreUnit: extraction.scoreUnit,
    rows: extraction.rows.map((row, rowIndex) => {
      const method = extractedDocument.pages.find(
        ({ pageNumber }) => pageNumber === row.pageNumber,
      )?.method;
      return {
        place: row.place,
        sourceTeamId: row.teamName,
        teamName: row.teamName,
        score: row.score,
        scoreText: row.scoreText,
        scoreUnit: row.scoreUnit,
        qualificationText: row.qualificationText,
        qualified: row.qualified,
        pageNumber: row.pageNumber,
        confidence: row.confidence,
        evidence: row.evidence.map(({ field, cell }) => ({
          field: `rows[${String(rowIndex)}].${field}`,
          kind: method === 'ocr' ? 'ocr' : 'pdf-text',
          locator: `page ${String(row.pageNumber)} table row ${String(rowIndex + 1)} ${field}`,
          page: row.pageNumber,
          excerpt: cell,
          confidence: row.confidence,
        })),
      };
    }),
    pageNumbers: extraction.pageNumbers,
    coverage: {
      expectedRowCount: null,
      rowsComplete: true,
      pagesComplete: extractedDocument.pages.length === extractedDocument.pageCount,
    },
    warnings: [
      ...extraction.warnings,
      `Detailed extracted document is staged at ${relativeArtifactPath}.`,
    ],
  });
  return {
    candidates: [],
    seasonStandingCandidates: [seasonStandingCandidate],
    sourceFailures: [],
  };
};

const icpcGlobalAcquisition = async (
  configuration: ReturnType<typeof sourceConfigurationSchema.parse>,
  options: CliOptions,
  root: string,
  dependencies: StandingsIngestionCliDependencies,
) => {
  const seasonYear = options.seasonYear;
  if (seasonYear === undefined) {
    throw new Error('ICPC Global acquisition requires a selected season.');
  }
  const directorySource = configuration.sources.find(({ id }) => id === 'icpc-global-directory');
  const finderSource = configuration.sources.find(({ id }) => id === 'icpc-global-finder');
  if (directorySource?.id === undefined || finderSource?.id === undefined) {
    throw new Error('Both ICPC Global directory and finder sources must be configured.');
  }
  const cycleLabel = `${String(seasonYear)}-${String(seasonYear + 1)}`;
  const directoryMapping = configuration.editionMappings.find(
    ({ sourceId, editionLabel }) => sourceId === directorySource.id && editionLabel === cycleLabel,
  );
  if (directoryMapping?.seasonYear !== seasonYear) {
    return {
      candidates: [],
      sourceFailures: [
        {
          sourceId: directorySource.id,
          contest: null,
          message: `ICPC Global cycle ${cycleLabel} has no matching reviewed edition mapping.`,
        },
      ],
    };
  }

  const render = dependencies.acquisition?.render ?? renderSelectedSourceState;
  const renderLimits: RenderLimits = {
    navigationTimeoutMs: 30_000,
    actionTimeoutMs: 30_000,
    maxRequests: 250,
    maxCaptureBytes: 16 * 1024 * 1024,
  };
  const directoryRequest: RenderRequest = {
    url: directorySource.baseUrl,
    actions: [
      { kind: 'click', selector: '[data-test="select_year"]' },
      { kind: 'click', selector: `[role="option"]:has-text("${cycleLabel}")` },
      {
        kind: 'click',
        selector: `button:has-text("The ${cycleLabel} ICPC Latin America Contests")`,
      },
    ],
    readySelector: '[role="region"] table',
    captureSelector: '[role="region"] table',
  };
  let renderedDirectory: RenderedSourceState;
  try {
    renderedDirectory = await render(directorySource, directoryRequest, renderLimits);
  } catch (error) {
    return {
      candidates: [],
      sourceFailures: [
        {
          sourceId: directorySource.id,
          contest: null,
          message: `Could not render ICPC Global cycle ${cycleLabel}: ${error instanceof Error ? error.message : 'render failed'}`,
        },
      ],
    };
  }
  const directory = discoverICPCGlobalDirectory(
    renderedDirectory.html,
    cycleLabel,
    renderedDirectory.finalUrl,
  );
  const directoryGpm = directory.contests.filter(({ kind }) => kind === 'gpm');
  const directoryFinals = directory.contests.filter(({ kind }) => kind === 'mexico-finals');
  if (
    directory.editionYear !== seasonYear ||
    directoryGpm.length !== 1 ||
    directoryFinals.length !== 1 ||
    directory.stagedLinks.length > 0
  ) {
    return {
      candidates: [],
      sourceFailures: [
        {
          sourceId: directorySource.id,
          contest: null,
          message: `ICPC Global directory discovery requires review: ${directory.stagedLinks.map(({ reason }) => reason).join('; ') || `expected one Mexican GPM and one Mexico Finals row for ${String(seasonYear)}`}`,
        },
      ],
    };
  }

  const finderHistory: {
    requestedUrl: string;
    finalUrl: string;
    contentSha256: string;
    discovery: ICPCGlobalFinderDiscovery;
  }[] = [];
  const visitedFinderUrls = new Set<string>();
  let currentFinderUrl = finderSource.baseUrl;
  let selectedFinder: ICPCGlobalFinderDiscovery | undefined;
  let selectedFinderUrl: string | undefined;
  for (let index = 0; index < MAX_ICPC_GLOBAL_PRIOR_YEARS; index += 1) {
    if (visitedFinderUrls.has(currentFinderUrl)) {
      return {
        candidates: [],
        sourceFailures: [
          {
            sourceId: finderSource.id,
            contest: null,
            message: `ICPC Global prior-year navigation repeated ${currentFinderUrl}.`,
          },
        ],
      };
    }
    visitedFinderUrls.add(currentFinderUrl);
    let renderedFinder: RenderedSourceState;
    try {
      renderedFinder = await render(
        finderSource,
        icpcGlobalFinderRenderRequest(currentFinderUrl),
        renderLimits,
      );
    } catch (error) {
      return {
        candidates: [],
        sourceFailures: [
          {
            sourceId: finderSource.id,
            contest: null,
            message: `Could not render ICPC Global finder page ${currentFinderUrl}: ${error instanceof Error ? error.message : 'render failed'}`,
          },
        ],
      };
    }
    const discovery = discoverICPCGlobalFinder(renderedFinder.html, renderedFinder.finalUrl);
    finderHistory.push({
      requestedUrl: currentFinderUrl,
      finalUrl: renderedFinder.finalUrl,
      contentSha256: renderedFinder.contentSha256,
      discovery,
    });
    if (discovery.eventKind !== 'mexico-finals' || discovery.editionYear === null) {
      return {
        candidates: [],
        sourceFailures: [
          {
            sourceId: finderSource.id,
            contest: null,
            message: `ICPC Global finder did not display a recognized Mexico Finals edition at ${renderedFinder.finalUrl}.`,
          },
        ],
      };
    }
    if (discovery.editionYear === seasonYear) {
      selectedFinder = discovery;
      selectedFinderUrl = renderedFinder.finalUrl;
      break;
    }
    if (discovery.editionYear < seasonYear || discovery.priorYearUrl === null) {
      break;
    }
    currentFinderUrl = discovery.priorYearUrl;
  }
  if (selectedFinder === undefined || selectedFinderUrl === undefined) {
    const visitedEditions = finderHistory
      .map(
        ({ finalUrl, discovery }) =>
          `${finalUrl} (${discovery.title ?? 'no title'}; edition ${String(discovery.editionYear ?? 'unknown')}; prior ${discovery.priorYearUrl ?? 'none'})`,
      )
      .join('; ');
    return {
      candidates: [],
      sourceFailures: [
        {
          sourceId: finderSource.id,
          contest: null,
          message: `ICPC Global finder did not reach Mexican edition ${String(seasonYear)} within ${String(MAX_ICPC_GLOBAL_PRIOR_YEARS)} saved prior-year pages. Visited: ${visitedEditions || 'none'}.`,
        },
      ],
    };
  }
  const finderMapping = configuration.editionMappings.find(
    ({ sourceId, editionLabel }) =>
      sourceId === finderSource.id && editionLabel === selectedFinder.sourceEditionLabel,
  );
  if (finderMapping?.seasonYear !== seasonYear) {
    return {
      candidates: [],
      sourceFailures: [
        {
          sourceId: finderSource.id,
          contest: null,
          message: `ICPC Global finder label ${selectedFinder.sourceEditionLabel ?? ''} has no matching reviewed edition mapping.`,
        },
      ],
    };
  }
  const finalsDirectoryContest = directoryFinals[0];
  const gpmDirectoryContest = directoryGpm[0];
  const finalsDirectoryPath = new URL(finalsDirectoryContest.contestUrl).pathname.toLowerCase();
  const selectedFinderPath = new URL(selectedFinderUrl).pathname.toLowerCase();
  const isCurrentFinderAlias =
    selectedFinderPath === new URL(finderSource.baseUrl).pathname.toLowerCase();
  const finalsStandingsDestinations = deduplicateICPCGlobalDestinations([
    selectedFinder.standingsUrl,
    finalsDirectoryContest.standingsUrl,
  ]);
  if (
    (finalsDirectoryPath !== selectedFinderPath && !isCurrentFinderAlias) ||
    selectedFinder.title === null ||
    selectedFinder.standingsUrl === null ||
    finalsStandingsDestinations.length === 0 ||
    selectedFinder.gpmContestUrl === null ||
    selectedFinder.stagedLinks.length > 0
  ) {
    return {
      candidates: [],
      sourceFailures: [
        {
          sourceId: finderSource.id,
          contest: null,
          message: `ICPC Global Mexico Finals finder page requires review: ${selectedFinder.stagedLinks.map(({ reason }) => reason).join('; ') || 'missing or mismatched standings/GPM links'}`,
        },
      ],
    };
  }
  if (
    new URL(gpmDirectoryContest.contestUrl).pathname.toLowerCase() !==
    new URL(selectedFinder.gpmContestUrl).pathname.toLowerCase()
  ) {
    return {
      candidates: [],
      sourceFailures: [
        {
          sourceId: finderSource.id,
          contest: null,
          message:
            'ICPC Global directory and Mexico Finals finder disagree on the GPM contest destination.',
        },
      ],
    };
  }

  const primaryFinalStandingsUrl = selectedFinder.standingsUrl;
  const finalAlternativeResults: {
    url: string;
    sourceId: string;
    contentSha256: string;
    documentType: string;
    extraction:
      | ScoreLATAMMexicoScoreboard
      | ICPCGlobalStandingsExtraction
      | ITESOAccumulatedExtraction
      | null;
  }[] = [];
  const pendingFinalReviews: { sourceId: string; message: string }[] = [];
  let readyScoreLATAMAlternative: {
    url: string;
    extraction: ScoreLATAMMexicoScoreboard & { status: 'ready' };
  } | null = null;
  for (const alternativeUrl of finalsStandingsDestinations.filter(
    (url) => url !== primaryFinalStandingsUrl,
  )) {
    const configuredFetch = await fetchFromConfiguredOrigin(
      alternativeUrl,
      configuration,
      dependencies.acquisition,
    );
    if (configuredFetch === null) {
      pendingFinalReviews.push({
        sourceId: directorySource.id,
        message: `Directory Finals Standings destination has no configured source origin: ${alternativeUrl}`,
      });
      continue;
    }
    if (configuredFetch.result.status !== 'fetched') {
      pendingFinalReviews.push({
        sourceId: configuredFetch.source.id,
        message: `Could not fetch directory Finals Standings alternative ${alternativeUrl}: ${configuredFetch.result.kind}: ${configuredFetch.result.message}`,
      });
      continue;
    }
    const fetched = configuredFetch.result;
    const documentType = classifyICPCGlobalDocument(fetched.contentType, fetched.body);
    let extraction:
      | ScoreLATAMMexicoScoreboard
      | ICPCGlobalStandingsExtraction
      | ITESOAccumulatedExtraction
      | null = null;
    if (configuredFetch.source.id === 'scorelatam' && documentType === 'html') {
      const sourceEditionLabel = String(seasonYear);
      const hasReviewedMapping = configuration.editionMappings.some(
        (mapping: { sourceId: string; editionLabel: string; seasonYear: number }) =>
          mapping.sourceId === configuredFetch.source.id &&
          mapping.editionLabel === sourceEditionLabel &&
          mapping.seasonYear === seasonYear,
      );
      if (hasReviewedMapping) {
        const edition: ScoreLATAMEdition = {
          editionYear: seasonYear,
          playedYear: null,
          sourceEditionLabel,
          url: fetched.finalUrl,
        };
        const scoreLATAMExtraction = parseScoreLATAMMexicoScoreboard(
          new TextDecoder().decode(fetched.body),
          edition,
        );
        extraction = scoreLATAMExtraction;
        if (scoreLATAMExtraction.status === 'ready') {
          readyScoreLATAMAlternative = {
            url: fetched.finalUrl,
            extraction: { ...scoreLATAMExtraction, status: 'ready' },
          };
        }
      }
      pendingFinalReviews.push({
        sourceId: configuredFetch.source.id,
        message:
          extraction !== null && extraction.status === 'ready'
            ? `Directory links to a parsed ScoreLATAM Finals alternative; it is retained as comparison evidence beside the ICPC Global candidate.`
            : `Directory ScoreLATAM Finals alternative requires review: ${hasReviewedMapping ? (extraction?.reason ?? 'scoreboard extraction was unavailable') : 'no matching reviewed season mapping'}`,
      });
    } else if (documentType === 'html') {
      extraction = parseICPCGlobalStandings(new TextDecoder().decode(fetched.body));
      pendingFinalReviews.push({
        sourceId: configuredFetch.source.id,
        message: `Directory Finals alternative was fetched and retained separately (${documentType}).`,
      });
    } else if (documentType === 'pdf' || documentType === 'image') {
      try {
        const document = await (dependencies.itesoDocumentExtractor ?? extractITESODocument)(
          fetched.body,
          documentType,
          root,
        );
        extraction = parseITESOAccumulatedDocument(document.pages, selectedFinder.title);
        pendingFinalReviews.push({
          sourceId: configuredFetch.source.id,
          message: `Directory Finals document alternative was extracted and staged separately (${documentType}).`,
        });
      } catch (error) {
        pendingFinalReviews.push({
          sourceId: configuredFetch.source.id,
          message: `Directory Finals document alternative requires review: ${error instanceof Error ? error.message : 'document extraction failed'}`,
        });
      }
    } else {
      pendingFinalReviews.push({
        sourceId: configuredFetch.source.id,
        message: `Directory Finals alternative has an unrecognized document type: ${alternativeUrl}`,
      });
    }
    finalAlternativeResults.push({
      url: fetched.finalUrl,
      sourceId: configuredFetch.source.id,
      contentSha256: fetched.contentSha256,
      documentType,
      extraction,
    });
  }

  let gpmFinderRendered: RenderedSourceState;
  try {
    gpmFinderRendered = await render(
      finderSource,
      icpcGlobalFinderRenderRequest(selectedFinder.gpmContestUrl),
      renderLimits,
    );
  } catch (error) {
    return {
      candidates: [],
      sourceFailures: [
        {
          sourceId: finderSource.id,
          contest: null,
          message: `Could not render the ICPC Global GPM finder entry: ${error instanceof Error ? error.message : 'render failed'}`,
        },
      ],
    };
  }
  const gpmFinder = discoverICPCGlobalFinder(gpmFinderRendered.html, gpmFinderRendered.finalUrl);
  const gpmMapping = configuration.editionMappings.find(
    ({ sourceId, editionLabel }) =>
      sourceId === finderSource.id && editionLabel === gpmFinder.sourceEditionLabel,
  );
  const finderFailures: { sourceId: string; contest: null; message: string }[] = [];
  if (
    gpmFinder.eventKind !== 'gpm' ||
    gpmFinder.editionYear !== seasonYear ||
    gpmMapping?.seasonYear !== seasonYear ||
    gpmFinder.standingsUrl === null
  ) {
    finderFailures.push({
      sourceId: finderSource.id,
      contest: null,
      message: `ICPC Global GPM page requires review: ${gpmFinder.stagedLinks.map(({ reason }) => reason).join('; ') || 'edition or See Standings link is missing'}`,
    });
  }

  const pendingGpmReviews: { sourceId: string; message: string }[] = [];
  const gpmStandingsResults: {
    url: string;
    sourceId: string;
    contentSha256: string | null;
    documentType: string;
    extraction: ICPCGlobalStandingsExtraction | ITESOAccumulatedExtraction | null;
    document: ITESOExtractedDocument | null;
  }[] = [];
  const gpmDestinations = deduplicateICPCGlobalDestinations([
    gpmFinder.standingsUrl,
    gpmDirectoryContest.standingsUrl,
  ]);
  for (const destination of gpmDestinations) {
    if (new URL(destination).origin === new URL(finderSource.baseUrl).origin) {
      try {
        const rendered = await render(
          finderSource,
          icpcGlobalStandingsRenderRequest(destination),
          renderLimits,
        );
        const extraction = parseICPCGlobalStandings(rendered.html);
        gpmStandingsResults.push({
          url: rendered.finalUrl,
          sourceId: finderSource.id,
          contentSha256: rendered.contentSha256,
          documentType: 'html',
          extraction,
          document: null,
        });
        pendingGpmReviews.push({
          sourceId: finderSource.id,
          message:
            extraction.status === 'ready' &&
            gpmFinder.title !== null &&
            extraction.title.toLowerCase().includes(gpmFinder.title.toLowerCase())
              ? 'GPM accumulated results were extracted but remain staged because season-standing candidates are not supported.'
              : `GPM accumulated results require review: ${extraction.status === 'staged' ? extraction.reason : 'standings title does not match the selected GPM edition'}`,
        });
      } catch (error) {
        pendingGpmReviews.push({
          sourceId: finderSource.id,
          message: `Could not render GPM standings ${destination}: ${error instanceof Error ? error.message : 'render failed'}`,
        });
      }
      continue;
    }
    const configuredFetch = await fetchFromConfiguredOrigin(
      destination,
      configuration,
      dependencies.acquisition,
    );
    if (configuredFetch === null) {
      pendingGpmReviews.push({
        sourceId: directorySource.id,
        message: `Directory Standings destination has no configured source origin: ${destination}`,
      });
      continue;
    }
    let activeSource = configuredFetch.source;
    if (configuredFetch.result.status !== 'fetched') {
      pendingGpmReviews.push({
        sourceId: directorySource.id,
        message: `Could not follow directory Standings destination ${destination}: ${configuredFetch.result.kind}: ${configuredFetch.result.message}`,
      });
      continue;
    }
    let fetched: Extract<SourceFetchResult, { status: 'fetched' }> = configuredFetch.result;
    let documentType = classifyICPCGlobalDocument(fetched.contentType, fetched.body);
    let document: ITESOExtractedDocument | null = null;
    let extraction: ICPCGlobalStandingsExtraction | ITESOAccumulatedExtraction | null = null;
    let htmlExtraction: ICPCGlobalStandingsExtraction | null = null;
    if (documentType === 'html') {
      htmlExtraction = parseICPCGlobalStandings(new TextDecoder().decode(fetched.body));
      extraction = htmlExtraction;
      if (
        htmlExtraction.status === 'staged' &&
        htmlExtraction.reason ===
          'recognized Mexico Finals title or totals standings table was not found'
      ) {
        const landingLink = discoverICPCGlobalStandingsLink(
          new TextDecoder().decode(fetched.body),
          fetched.finalUrl,
        );
        if (landingLink.status === 'found' && landingLink.url !== fetched.finalUrl) {
          const nextFetch = await fetchFromConfiguredOrigin(
            landingLink.url,
            configuration,
            dependencies.acquisition,
          );
          if (nextFetch !== null) {
            activeSource = nextFetch.source;
            if (nextFetch.result.status !== 'fetched') {
              pendingGpmReviews.push({
                sourceId: activeSource.id,
                message: `Could not follow landing-page standings link ${landingLink.url}: ${nextFetch.result.kind}: ${nextFetch.result.message}`,
              });
              continue;
            }
            fetched = nextFetch.result;
            documentType = classifyICPCGlobalDocument(fetched.contentType, fetched.body);
            htmlExtraction =
              documentType === 'html'
                ? parseICPCGlobalStandings(new TextDecoder().decode(fetched.body))
                : null;
            extraction = htmlExtraction;
          }
        } else {
          pendingGpmReviews.push({
            sourceId: activeSource.id,
            message:
              landingLink.status === 'staged'
                ? `ICPC Global result landing page requires review: ${landingLink.candidates.map(({ reason }) => reason).join('; ')}`
                : `ICPC Global result landing page has no standings link: ${fetched.finalUrl}`,
          });
        }
      }
    }
    if (documentType === 'pdf' || documentType === 'image') {
      try {
        document = await (dependencies.itesoDocumentExtractor ?? extractITESODocument)(
          fetched.body,
          documentType,
          root,
        );
        extraction = parseITESOAccumulatedDocument(
          document.pages,
          gpmFinder.title ?? gpmDirectoryContest.name,
        );
      } catch (error) {
        pendingGpmReviews.push({
          sourceId: activeSource.id,
          message: `ICPC Global GPM document requires local extraction review: ${error instanceof Error ? error.message : 'document extraction failed'}`,
        });
      }
    }
    if (documentType === 'html' && htmlExtraction !== null) {
      const titleMatches =
        htmlExtraction.status === 'ready' &&
        gpmFinder.title !== null &&
        htmlExtraction.title.toLowerCase().includes(gpmFinder.title.toLowerCase());
      pendingGpmReviews.push({
        sourceId: activeSource.id,
        message: titleMatches
          ? 'Followed the GPM Standings link; season results remain staged because season-standing candidates are not supported.'
          : `GPM HTML standings require review: ${htmlExtraction.status === 'staged' ? htmlExtraction.reason : 'standings title does not match the selected GPM edition'}`,
      });
    } else if (documentType === 'unknown') {
      pendingGpmReviews.push({
        sourceId: activeSource.id,
        message: `Directory Standings destination has unrecognized document type: ${destination}`,
      });
    }
    gpmStandingsResults.push({
      url: fetched.finalUrl,
      sourceId: activeSource.id,
      contentSha256: fetched.contentSha256,
      documentType,
      extraction,
      document,
    });
  }

  const request: AcquisitionRequest = {
    configuration,
    sourceId: finderSource.id,
    seasonYear,
    seriesId: 'mexico-finals',
    stage: 'final',
    discoveryUrl: finderSource.baseUrl,
    content: {
      ...(new URL(primaryFinalStandingsUrl).origin === new URL(finderSource.baseUrl).origin
        ? {
            kind: 'render' as const,
            request: icpcGlobalStandingsRenderRequest(primaryFinalStandingsUrl),
            limits: renderLimits,
          }
        : { kind: 'fetch' as const, url: primaryFinalStandingsUrl }),
    },
    parserVersion: 'icpc-global-mexico-finals-v1',
    promptVersion: null,
    model: null,
    options: {
      adapter: 'icpc-global-mexico-finals-v1',
      sourceEditionLabel: selectedFinder.sourceEditionLabel,
      publicationState: selectedFinder.publicationState,
    },
    parse: (body) => {
      const extraction = parseICPCGlobalStandings(new TextDecoder().decode(body));
      if (extraction.status !== 'ready') {
        return Promise.reject(new Error(extraction.reason));
      }
      if (!extraction.title.toLowerCase().includes(selectedFinder.title?.toLowerCase() ?? '')) {
        return Promise.reject(
          new Error('Standings title does not match the selected Mexico Finals edition.'),
        );
      }
      return Promise.resolve(icpcGlobalFinalPayload(extraction, selectedFinder));
    },
  };
  const artifactName = `run-${String(Date.now())}-${randomUUID()}-icpc-global-${String(seasonYear)}.json`;
  const stagedArtifactPath = path.relative(
    root,
    path.join(root, '.standings-ingestion/staged', artifactName),
  );
  const alternativeRequests: AcquisitionRequest[] = [];
  const scoreLATAMSource = configuration.sources.find(({ id }) => id === 'scorelatam');
  if (readyScoreLATAMAlternative !== null && scoreLATAMSource !== undefined) {
    const extraction = readyScoreLATAMAlternative.extraction;
    const edition: ScoreLATAMEdition = {
      editionYear: extraction.editionYear,
      playedYear: extraction.playedYear,
      sourceEditionLabel: extraction.sourceEditionLabel,
      url: readyScoreLATAMAlternative.url,
    };
    alternativeRequests.push({
      configuration,
      sourceId: scoreLATAMSource.id,
      seasonYear,
      seriesId: 'mexico-finals',
      stage: 'final',
      discoveryUrl: scoreLATAMSource.baseUrl,
      content: { kind: 'fetch', url: readyScoreLATAMAlternative.url },
      parserVersion: 'scorelatam-mexico-scoregroup-v2',
      promptVersion: null,
      model: null,
      options: {
        adapter: 'scorelatam-mexico-scoregroup-v2',
        sourceEditionLabel: edition.sourceEditionLabel,
        eventEquivalence: 'reviewer-approved',
      },
      parse: (body) => {
        const parsed = parseScoreLATAMMexicoScoreboard(new TextDecoder().decode(body), edition);
        if (parsed.status !== 'ready') {
          return Promise.reject(
            new Error(parsed.reason ?? 'ScoreLATAM Mexico Finals alternative requires review.'),
          );
        }
        return Promise.resolve(scoreLATAMCandidatePayload(parsed, stagedArtifactPath));
      },
    });
  }
  let finalStandingsCapture: RenderedSourceState | null = null;
  const renderWithStandingsEvidence: typeof render = async (source, rawRequest, limits) => {
    const renderRequest = renderRequestSchema.parse(rawRequest);
    const rendered = await render(source, renderRequest, limits);
    if (source.id === finderSource.id && rendered.discoveryUrl === primaryFinalStandingsUrl) {
      finalStandingsCapture = rendered;
    }
    return rendered;
  };
  const defaultAcquisitionDependencies: AcquisitionDependencies = {
    cache: new BoundedJsonCache({
      directory: path.join(root, '.standings-ingestion/cache'),
      ttlMs: 7 * 24 * 60 * 60 * 1000,
      maxEntries: 1000,
      maxEntryBytes: 32 * 1024 * 1024,
    }),
    parse: () =>
      Promise.reject(new Error('ICPC Global parser was not assigned to its acquisition job.')),
  };
  const acquisitionDependencies = {
    ...(dependencies.acquisition ?? defaultAcquisitionDependencies),
    render: renderWithStandingsEvidence,
  };
  const batch = await acquireStandingsBatch(
    [request, ...alternativeRequests],
    acquisitionDependencies,
  );
  const artifactPath = await writeJsonAtomically(
    path.join(root, '.standings-ingestion/staged'),
    artifactName,
    {
      schemaVersion: 1,
      sourceIds: [directorySource.id, finderSource.id],
      authorityId: directorySource.authorityId,
      seasonYear,
      cycleLabel,
      directory: {
        url: renderedDirectory.finalUrl,
        contentSha256: renderedDirectory.contentSha256,
        contests: directory.contests,
        excludedContestLabels: directory.excludedContestLabels,
        stagedLinks: directory.stagedLinks,
      },
      finderHistory,
      mexicoFinals: selectedFinder,
      directoryFinalStandingsUrl: finalsDirectoryContest.standingsUrl,
      finalAlternativeResults,
      primaryFinalStandingsCapture: finalStandingsCapture,
      gpmFinder: {
        url: gpmFinderRendered.finalUrl,
        contentSha256: gpmFinderRendered.contentSha256,
        discovery: gpmFinder,
      },
      gpmStandingsResults,
      finalStandingsUrl: primaryFinalStandingsUrl,
    },
  );
  const relativeArtifactPath = path.relative(root, artifactPath);
  const sourceFailures = [
    ...finderFailures,
    ...pendingFinalReviews.map(({ sourceId, message }) => ({
      sourceId,
      contest: null,
      message: `${message} Evidence staged at ${relativeArtifactPath}.`,
    })),
    ...pendingGpmReviews.map(({ sourceId, message }) => ({
      sourceId,
      contest: null,
      message: `${message} Evidence staged at ${relativeArtifactPath}.`,
    })),
    ...batch.sourceFailures.map((failure) => ({
      ...failure,
      contest: failure.contest,
      message: `${failure.message}; ICPC Global evidence staged at ${relativeArtifactPath}.`,
    })),
  ];
  if (batch.candidates.length === 0 && sourceFailures.length === 0) {
    sourceFailures.push({
      sourceId: finderSource.id,
      contest: null,
      message: `ICPC Global Mexico Finals extraction produced no candidate. Evidence staged at ${relativeArtifactPath}.`,
    });
  }
  return { candidates: batch.candidates, sourceFailures };
};

const icpcGlobalStandingsRenderRequest = (url: string): RenderRequest => ({
  url,
  actions: [
    { kind: 'click', selector: '[role="combobox"]' },
    { kind: 'click', selector: '[role="option"]:has-text("1000")' },
    {
      kind: 'waitForPagination',
      tableSelector: 'main table',
      summarySelector: 'main',
    },
  ],
  readySelector: 'table thead tr:first-of-type',
  captureSelector: 'main',
});

const icpcGlobalFinderRenderRequest = (url: string): RenderRequest => ({
  url,
  actions: [],
  readySelector: 'main a:has-text("See Prior Year")',
  captureSelector: 'main',
});

const icpcGlobalFinalPayload = (
  extraction: ICPCGlobalStandingsExtraction & { status: 'ready' },
  finder: ICPCGlobalFinderDiscovery,
): SourceCandidatePayload => ({
  sourceEditionLabel: finder.sourceEditionLabel ?? String(finder.editionYear),
  contest: {
    seasonYear: finder.editionYear ?? 0,
    seriesId: 'mexico-finals',
    stage: 'final',
    name: finder.title ?? 'ICPC Mexico Finals',
    publicationState: finder.publicationState,
    date: null,
    durationMinutes: null,
    penaltyMinutesPerFailedAttempt: null,
    problemLabels: [],
  },
  rows: extraction.rows.map((row, rowIndex) => {
    const rowIndexText = String(rowIndex);
    const evidence = (field: string, value: string) => ({
      field: `rows[${rowIndexText}].${field}`,
      kind: 'html-cell' as const,
      locator: row.locator,
      page: null,
      excerpt: value,
      confidence: 1,
    });
    return {
      place: row.place,
      sourceTeamId: null,
      teamName: row.team,
      sourceSchoolId: null,
      schoolName: row.institution,
      results: null,
      publishedTotals: { solved: row.solved, penalty: row.totalTime },
      evidence: [
        evidence('place', String(row.place)),
        evidence('teamName', row.team),
        evidence('schoolName', row.institution),
        evidence('publishedTotals.solved', String(row.solved)),
        evidence('publishedTotals.penalty', String(row.totalTime)),
        ...(row.lastSolution === null ? [] : [evidence('lastSolution', row.lastSolution)]),
      ],
    };
  }),
  coverage: {
    expectedRowCount: extraction.expectedRowCount,
    rowsComplete: extraction.rowsComplete,
    paginationComplete: extraction.rowsComplete,
  },
  warnings: [
    ...extraction.warnings,
    'ICPC Global publishes totals-only Mexico Finals standings; per-problem results are not inferred.',
  ],
});

export const loadArchiveFiles = async (root: string): Promise<JsonFiles> => {
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
  const candidates =
    options.acquireICPCMexico ||
    options.acquireScoreLATAM ||
    options.acquireITESO ||
    options.acquireICPCGlobal
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
    : options.acquireScoreLATAM
      ? await scoreLATAMAcquisition(parsedConfiguration, options, root, dependencies.acquisition)
      : options.acquireITESO
        ? await itesoAcquisition(parsedConfiguration, options, root, dependencies)
        : options.acquireICPCGlobal
          ? await icpcGlobalAcquisition(parsedConfiguration, options, root, dependencies)
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
    seasonStandingCandidates:
      'seasonStandingCandidates' in acquisition
        ? (acquisition as { seasonStandingCandidates: readonly unknown[] }).seasonStandingCandidates
        : [],
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
        : baseProposal.candidates.length + baseProposal.seasonStandingCandidates.length === 0
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
