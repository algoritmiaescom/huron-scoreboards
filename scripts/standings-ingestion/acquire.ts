import { z } from 'zod';

import {
  selectPreferredSourceIds,
  sourceConfigurationSchema,
  standingsCandidateSchema,
  validateCandidateSource,
} from '@/features/scoreboards/ingestion/schemas';
import {
  contestStageSchema,
  problemSchema,
  seasonYearSchema,
  slugSchema,
} from '@/features/scoreboards/model/schemas';

import { BoundedSourceFetcher } from './fetch';
import { parseFetchedContent } from './parse-cache';
import { renderSelectedSourceState } from './render';

import type { BoundedJsonCache, ParseCacheIdentity } from './cache';
import type { SourceFetchResult } from './fetch';
import type { CachedParseResult } from './parse-cache';
import type { RenderLimits, RenderRequest } from './render';

export interface SourceCandidatePayload {
  sourceEditionLabel: string;
  contest: {
    seasonYear: number;
    seriesId: string;
    stage: z.infer<typeof contestStageSchema>;
    name: string;
    publicationState: 'final' | 'provisional' | 'live' | 'unknown';
    date: string | null;
    durationMinutes: number | null;
    penaltyMinutesPerFailedAttempt: number | null;
    problemLabels: string[];
  };
  rows: unknown[];
  coverage: {
    expectedRowCount: number | null;
    rowsComplete: boolean;
    paginationComplete: boolean | null;
  };
  warnings: string[];
}

const parsedCandidatePayloadSchema: z.ZodType<SourceCandidatePayload> = z.object({
  sourceEditionLabel: z.string().min(1),
  contest: z.object({
    seasonYear: seasonYearSchema,
    seriesId: slugSchema,
    stage: contestStageSchema,
    name: z.string().min(1),
    publicationState: z.enum(['final', 'provisional', 'live', 'unknown']),
    date: z.iso.date().nullable(),
    durationMinutes: z.number().int().positive().nullable(),
    penaltyMinutesPerFailedAttempt: z.number().int().nonnegative().nullable(),
    problemLabels: z.array(problemSchema.shape.label),
  }),
  rows: z.array(z.unknown()).min(1),
  coverage: z.object({
    expectedRowCount: z.number().int().positive().nullable(),
    rowsComplete: z.boolean(),
    paginationComplete: z.boolean().nullable(),
  }),
  warnings: z.array(z.string().min(1)),
});

export type SourceContentRequest =
  { kind: 'fetch'; url: string } | { kind: 'render'; request: RenderRequest; limits: RenderLimits };

export interface AcquisitionRequest {
  configuration: unknown;
  sourceId: string;
  seasonYear: number;
  seriesId: string;
  stage: z.infer<typeof contestStageSchema>;
  discoveryUrl: string;
  content: SourceContentRequest;
  parserVersion: string;
  promptVersion: string | null;
  model: string | null;
  options: unknown;
  parse?: (body: Uint8Array, contentType: string | null) => Promise<unknown>;
}

export interface AcquisitionDependencies {
  cache: BoundedJsonCache;
  parse: (body: Uint8Array, contentType: string | null) => Promise<unknown>;
  fetcherForSource?: (
    configuration: z.infer<typeof sourceConfigurationSchema>,
    sourceId: string,
  ) => BoundedSourceFetcher;
  render?: typeof renderSelectedSourceState;
  now?: () => Date;
}

export interface AcquisitionBatchResult {
  status: 'complete' | 'partial' | 'failed';
  candidates: z.infer<typeof standingsCandidateSchema>[];
  sourceFailures: {
    sourceId: string;
    contest: {
      seasonYear: number;
      seriesId: string;
      stage: z.infer<typeof contestStageSchema>;
    };
    message: string;
  }[];
}

export type AcquisitionOutcome =
  | {
      status: 'candidate';
      candidate: z.infer<typeof standingsCandidateSchema>;
      cache: 'hit' | 'miss';
    }
  | {
      status: 'failed';
      sourceId: string;
      contest: {
        seasonYear: number;
        seriesId: string;
        stage: z.infer<typeof contestStageSchema>;
      };
      kind: 'configuration' | 'source-policy' | 'fetch' | 'render' | 'parse' | 'candidate';
      message: string;
    };

type AcquisitionFailure = Extract<AcquisitionOutcome, { status: 'failed' }>;
type FetchedContent = Extract<SourceFetchResult, { status: 'fetched' }>;
type ParsedPayload = z.infer<typeof parsedCandidatePayloadSchema>;

const failure = (
  request: AcquisitionRequest,
  kind: AcquisitionFailure['kind'],
  message: string,
): AcquisitionFailure => ({
  status: 'failed',
  sourceId: request.sourceId,
  contest: {
    seasonYear: request.seasonYear,
    seriesId: request.seriesId,
    stage: request.stage,
  },
  kind,
  message,
});

const defaultFetcherForSource = (
  configuration: z.infer<typeof sourceConfigurationSchema>,
  sourceId: string,
): BoundedSourceFetcher => {
  const source = configuration.sources.find(({ id }) => id === sourceId);
  if (source === undefined) {
    throw new Error(`Unknown source \`${sourceId}\`.`);
  }
  return new BoundedSourceFetcher(source, {
    timeoutMs: 20_000,
    maxResponseBytes: 32 * 1024 * 1024,
    maxRequests: 20,
    maxRedirects: 3,
  });
};

const fetchContent = async (
  request: AcquisitionRequest,
  configuration: z.infer<typeof sourceConfigurationSchema>,
  source: z.infer<typeof sourceConfigurationSchema>['sources'][number],
  dependencies: AcquisitionDependencies,
): Promise<FetchedContent | AcquisitionFailure> => {
  if (request.content.kind === 'fetch') {
    const fetcher = (dependencies.fetcherForSource ?? defaultFetcherForSource)(
      configuration,
      request.sourceId,
    );
    const result = await fetcher.fetch(request.content.url);
    if (result.status === 'failed') {
      return failure(request, 'fetch', `${result.kind}: ${result.message}`);
    }
    return result;
  }

  try {
    const render = dependencies.render ?? renderSelectedSourceState;
    const rendered = await render(source, request.content.request, request.content.limits);
    return {
      status: 'fetched',
      sourceId: rendered.sourceId,
      discoveryUrl: rendered.discoveryUrl,
      finalUrl: rendered.finalUrl,
      httpStatus: 200,
      contentType: 'text/html',
      body: new TextEncoder().encode(rendered.html),
      contentSha256: rendered.contentSha256,
      redirects: 0,
    };
  } catch (error) {
    return failure(
      request,
      'render',
      error instanceof Error ? error.message : 'Rendered capture failed.',
    );
  }
};

export const acquireStandingsCandidate = async (
  request: AcquisitionRequest,
  dependencies: AcquisitionDependencies,
): Promise<AcquisitionOutcome> => {
  const configurationResult = sourceConfigurationSchema.safeParse(request.configuration);
  if (!configurationResult.success) {
    return failure(request, 'configuration', configurationResult.error.message);
  }
  const configuration = configurationResult.data;
  const source = configuration.sources.find(({ id }) => id === request.sourceId);
  if (source === undefined) {
    return failure(request, 'source-policy', `Unknown source \`${request.sourceId}\`.`);
  }
  const preferred = selectPreferredSourceIds(
    configuration,
    request.seasonYear,
    request.seriesId,
    request.stage,
  );
  if (!preferred.includes(request.sourceId)) {
    return failure(
      request,
      'source-policy',
      `Source \`${request.sourceId}\` is not preferred for this edition and stage.`,
    );
  }
  if (!source.supportedStages.includes(request.stage)) {
    return failure(
      request,
      'source-policy',
      `Source \`${request.sourceId}\` does not support stage \`${request.stage}\`.`,
    );
  }

  const content = await fetchContent(request, configuration, source, dependencies);
  if (content.status === 'failed') {
    return content;
  }
  const cacheIdentity: Omit<ParseCacheIdentity, 'contentSha256'> = {
    parserVersion: request.parserVersion,
    promptVersion: request.promptVersion,
    model: request.model,
    options: request.options,
  };
  let parsed: CachedParseResult<ParsedPayload>;
  try {
    parsed = await parseFetchedContent({
      response: content,
      identity: cacheIdentity,
      cache: dependencies.cache,
      schema: parsedCandidatePayloadSchema,
      parse: (body) => (request.parse ?? dependencies.parse)(body, content.contentType),
    });
  } catch (error) {
    return failure(
      request,
      'parse',
      error instanceof Error ? error.message : 'Candidate extraction failed.',
    );
  }

  if (
    parsed.data.contest.seasonYear !== request.seasonYear ||
    parsed.data.contest.seriesId !== request.seriesId ||
    parsed.data.contest.stage !== request.stage
  ) {
    return failure(
      request,
      'candidate',
      'Parser output contest identity does not match the requested edition/stage.',
    );
  }

  const candidateInput = {
    candidateId: `${request.sourceId}-${String(request.seasonYear)}-${request.seriesId}-${request.stage}-${content.contentSha256.slice(0, 12)}-${parsed.cacheKey.slice(0, 12)}`,
    sourceId: request.sourceId,
    authorityId: source.authorityId,
    discoveryUrl: request.discoveryUrl,
    finalUrl: content.finalUrl,
    retrievedAt: (dependencies.now ?? (() => new Date()))().toISOString(),
    contentSha256: content.contentSha256,
    parserVersion: request.parserVersion,
    promptVersion: request.promptVersion,
    model: request.model,
    ...parsed.data,
  };
  const candidateResult = standingsCandidateSchema.safeParse(candidateInput);
  if (!candidateResult.success) {
    return failure(request, 'candidate', candidateResult.error.message);
  }
  const sourceIssues = validateCandidateSource(candidateResult.data, configuration);
  if (sourceIssues.length > 0) {
    return failure(request, 'source-policy', sourceIssues.join('; '));
  }
  return { status: 'candidate', candidate: candidateResult.data, cache: parsed.cache };
};

const MAX_ACQUISITION_JOBS = 20;

export const acquireStandingsBatch = async (
  requests: readonly AcquisitionRequest[],
  dependencies: AcquisitionDependencies,
): Promise<AcquisitionBatchResult> => {
  if (requests.length === 0 || requests.length > MAX_ACQUISITION_JOBS) {
    throw new RangeError(
      `Acquisition batch must contain 1 to ${String(MAX_ACQUISITION_JOBS)} jobs.`,
    );
  }
  const candidates: z.infer<typeof standingsCandidateSchema>[] = [];
  const sourceFailures: AcquisitionBatchResult['sourceFailures'] = [];
  const sharedFetchers = new Map<string, BoundedSourceFetcher>();
  const batchDependencies: AcquisitionDependencies = {
    ...dependencies,
    fetcherForSource: (configuration, sourceId) => {
      const current = sharedFetchers.get(sourceId);
      if (current !== undefined) {
        return current;
      }
      const fetcher =
        dependencies.fetcherForSource === undefined
          ? defaultFetcherForSource(configuration, sourceId)
          : dependencies.fetcherForSource(configuration, sourceId);
      sharedFetchers.set(sourceId, fetcher);
      return fetcher;
    },
  };

  for (const request of requests) {
    const outcome = await acquireStandingsCandidate(request, batchDependencies);
    if (outcome.status === 'candidate') {
      candidates.push(outcome.candidate);
    } else {
      sourceFailures.push({
        sourceId: outcome.sourceId,
        contest: outcome.contest,
        message: `${outcome.kind}: ${outcome.message}`,
      });
    }
  }

  const status =
    candidates.length === 0 ? 'failed' : sourceFailures.length > 0 ? 'partial' : 'complete';
  return { status, candidates, sourceFailures };
};
