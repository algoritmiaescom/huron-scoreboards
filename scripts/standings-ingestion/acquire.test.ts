import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  acquireStandingsBatch,
  acquireStandingsCandidate,
  type AcquisitionDependencies,
} from './acquire';
import { BoundedJsonCache } from './cache';

import type { BoundedSourceFetcher, SourceFetchResult } from './fetch';
import type { RenderedSourceState } from './render';
import type { SourceConfiguration } from '@/features/scoreboards/ingestion/schemas';

const sourceConfiguration: SourceConfiguration = {
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

const payload = {
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

const fetched: Extract<SourceFetchResult, { status: 'fetched' }> = {
  status: 'fetched',
  sourceId: 'icpc-mexico',
  discoveryUrl: 'https://icpcmexico.org/contests',
  finalUrl: 'https://icpcmexico.org/2024/qualifier-1',
  httpStatus: 200,
  contentType: 'text/html',
  body: new Uint8Array([1, 2, 3]),
  contentSha256: 'a'.repeat(64),
  redirects: 0,
};

const request = {
  configuration: sourceConfiguration,
  sourceId: 'icpc-mexico',
  seasonYear: 2024,
  seriesId: 'gpm',
  stage: 'qualifier-1' as const,
  discoveryUrl: 'https://icpcmexico.org/contests',
  content: { kind: 'fetch' as const, url: 'https://icpcmexico.org/2024/qualifier-1' },
  parserVersion: 'parser-v1',
  promptVersion: 'prompt-v1',
  model: 'model-v1',
  options: { temperature: 0 },
};

const createDependencies = async (
  overrides: {
    fetch?: () => Promise<SourceFetchResult>;
    parse?: (body: Uint8Array, contentType: string | null) => Promise<unknown>;
    render?: AcquisitionDependencies['render'];
  } = {},
) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'huron-acquisition-cache-'));
  const cache = new BoundedJsonCache({
    directory,
    maxEntries: 10,
    maxEntryBytes: 1024,
    ttlMs: 60_000,
  });
  const fetchCalls: string[] = [];
  const parse = vi.fn(overrides.parse ?? (() => Promise.resolve(payload)));
  const dependencies = {
    cache,
    parse,
    fetcherForSource: () =>
      ({
        fetch: async (url: string) => {
          fetchCalls.push(url);
          return Promise.resolve(overrides.fetch === undefined ? fetched : overrides.fetch());
        },
      }) as unknown as BoundedSourceFetcher,
    ...(overrides.render === undefined ? {} : { render: overrides.render }),
    now: () => new Date('2026-10-28T12:00:00Z'),
  };
  return { directory, dependencies, fetchCalls, parse };
};

describe('standings candidate acquisition', () => {
  it('checks source policy, parses fetched content, stamps provenance, and reuses cached output', async () => {
    const { directory, dependencies, fetchCalls, parse } = await createDependencies();
    try {
      const first = await acquireStandingsCandidate(request, dependencies);
      const second = await acquireStandingsCandidate(request, dependencies);
      expect(first).toMatchObject({ status: 'candidate', cache: 'miss' });
      expect(second).toMatchObject({ status: 'candidate', cache: 'hit' });
      if (first.status === 'candidate' && second.status === 'candidate') {
        expect(first.candidate.candidateId).toBe(second.candidate.candidateId);
        expect(first.candidate.discoveryUrl).toBe(request.discoveryUrl);
        expect(first.candidate.finalUrl).toBe(fetched.finalUrl);
        expect(first.candidate.retrievedAt).toBe('2026-10-28T12:00:00.000Z');
      }
      expect(fetchCalls).toEqual([request.content.url, request.content.url]);
      expect(parse).toHaveBeenCalledTimes(1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects sources outside the reviewed priority without fetching', async () => {
    const { directory, dependencies, fetchCalls } = await createDependencies();
    try {
      const outcome = await acquireStandingsCandidate(
        { ...request, sourceId: 'unreviewed' },
        dependencies,
      );
      expect(outcome).toMatchObject({ status: 'failed', kind: 'source-policy' });
      expect(fetchCalls).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('preserves bounded fetch failures as explicit acquisition failures', async () => {
    const { directory, dependencies } = await createDependencies({
      fetch: () =>
        Promise.resolve({
          status: 'failed',
          sourceId: 'icpc-mexico',
          url: request.content.url,
          kind: 'timeout',
          message: 'request timed out',
        }),
    });
    try {
      await expect(acquireStandingsCandidate(request, dependencies)).resolves.toMatchObject({
        status: 'failed',
        kind: 'fetch',
        message: 'timeout: request timed out',
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('uses the rendered selected state as parser input and retains its content hash', async () => {
    const rendered: RenderedSourceState = {
      sourceId: 'icpc-mexico',
      discoveryUrl: request.discoveryUrl,
      finalUrl: 'https://icpcmexico.org/selected',
      capturedAt: '2026-10-28T12:00:00Z',
      html: '<table id="standings"></table>',
      contentSha256: 'b'.repeat(64),
      requests: 4,
    };
    const { directory, dependencies, fetchCalls, parse } = await createDependencies({
      render: () => Promise.resolve(rendered),
    });
    try {
      const outcome = await acquireStandingsCandidate(
        {
          ...request,
          content: {
            kind: 'render',
            request: {
              url: request.content.url,
              actions: [],
              readySelector: '#standings',
              captureSelector: '#standings',
            },
            limits: {
              navigationTimeoutMs: 1000,
              actionTimeoutMs: 1000,
              maxRequests: 10,
              maxCaptureBytes: 1024,
            },
          },
        },
        dependencies,
      );
      expect(outcome).toMatchObject({ status: 'candidate', cache: 'miss' });
      if (outcome.status === 'candidate') {
        expect(outcome.candidate.contentSha256).toBe(rendered.contentSha256);
        expect(outcome.candidate.finalUrl).toBe(rendered.finalUrl);
      }
      expect(fetchCalls).toEqual([]);
      expect(parse).toHaveBeenCalledWith(new TextEncoder().encode(rendered.html), 'text/html');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects parser output for another edition instead of emitting a candidate', async () => {
    const { directory, dependencies } = await createDependencies({
      parse: () =>
        Promise.resolve({
          ...payload,
          contest: { ...payload.contest, seasonYear: 2025 },
        }),
    });
    try {
      await expect(acquireStandingsCandidate(request, dependencies)).resolves.toMatchObject({
        status: 'failed',
        kind: 'candidate',
        message: 'Parser output contest identity does not match the requested edition/stage.',
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('keeps independently successful jobs when another bounded acquisition fails', async () => {
    const { directory, dependencies } = await createDependencies();
    let calls = 0;
    const batchDependencies = {
      ...dependencies,
      fetcherForSource: () =>
        ({
          fetch: () => {
            calls += 1;
            return Promise.resolve(
              calls === 1
                ? fetched
                : {
                    status: 'failed' as const,
                    sourceId: 'icpc-mexico',
                    url: request.content.url,
                    kind: 'http' as const,
                    message: 'source unavailable',
                    httpStatus: 503,
                  },
            );
          },
        }) as unknown as BoundedSourceFetcher,
    };
    try {
      const result = await acquireStandingsBatch([request, request], batchDependencies);
      expect(result.status).toBe('partial');
      expect(result.candidates).toHaveLength(1);
      expect(result.sourceFailures).toEqual([
        expect.objectContaining({
          sourceId: 'icpc-mexico',
          message: 'fetch: http: source unavailable',
        }),
      ]);
      expect(calls).toBe(2);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('bounds acquisition batches to a small sequential work queue', async () => {
    const { directory, dependencies, fetchCalls } = await createDependencies();
    try {
      const result = await acquireStandingsBatch([request, request], dependencies);
      expect(result.status).toBe('complete');
      expect(result.candidates).toHaveLength(2);
      expect(fetchCalls).toHaveLength(2);
      await expect(acquireStandingsBatch([], dependencies)).rejects.toThrow(RangeError);
      await expect(
        acquireStandingsBatch(
          Array.from({ length: 21 }, () => request),
          dependencies,
        ),
      ).rejects.toThrow(RangeError);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
