import { describe, expect, it, vi } from 'vitest';

import { BoundedSourceFetcher } from './fetch';

import type { SourceFetchImplementation } from './fetch';
import type { SourceDefinition } from '@/features/scoreboards/ingestion/schemas';
import type {
  Response as FetchResponse,
  HeadersInit,
  RequestInit,
  ResponseInit,
} from 'undici-types';

const source: SourceDefinition = {
  id: 'icpc-mexico',
  authorityId: 'icpc-mexico',
  name: 'ICPC Mexico',
  baseUrl: 'https://icpcmexico.org/contests',
  supportedStages: ['fecha-0', 'qualifier-1'],
  supportsSeasonStanding: true,
};

const options = {
  timeoutMs: 100,
  maxResponseBytes: 16,
  maxRequests: 4,
  maxRedirects: 2,
};

const ResponseConstructor = (
  globalThis as unknown as {
    Response: new (body?: string | null, init?: ResponseInit) => FetchResponse;
  }
).Response;

const response = (body: string, headers: HeadersInit = {}): FetchResponse =>
  new ResponseConstructor(body, { status: 200, headers });

const fetchMock = (
  implementation: (url: string, init: RequestInit) => FetchResponse | Promise<FetchResponse>,
): SourceFetchImplementation =>
  vi.fn((input: string, init: RequestInit) => Promise.resolve(implementation(input, init)));

describe('bounded source fetcher', () => {
  it('rejects off-origin, non-HTTPS, and credential-bearing URLs before issuing requests', async () => {
    const request = fetchMock(() => response('unused'));
    const fetcher = new BoundedSourceFetcher(source, { ...options, fetchImpl: request });
    for (const url of [
      'http://icpcmexico.org/contests',
      'https://example.com/standings',
      'https://user:pass@icpcmexico.org/contests',
    ]) {
      await expect(fetcher.fetch(url)).resolves.toMatchObject({
        status: 'failed',
        kind: 'invalid-url',
      });
    }
    expect(request).not.toHaveBeenCalled();
  });

  it('follows bounded same-origin redirects manually and returns content provenance', async () => {
    const request = fetchMock((url, init) => {
      expect(init.redirect).toBe('manual');
      if (url.endsWith('/discovery')) {
        return new ResponseConstructor(null, {
          status: 302,
          headers: { location: '/contests/final' },
        });
      }
      return response('standings', { 'content-type': 'text/html; charset=utf-8' });
    });
    const fetcher = new BoundedSourceFetcher(source, { ...options, fetchImpl: request });
    const result = await fetcher.fetch('https://icpcmexico.org/discovery');
    expect(result).toMatchObject({
      status: 'fetched',
      sourceId: 'icpc-mexico',
      discoveryUrl: 'https://icpcmexico.org/discovery',
      finalUrl: 'https://icpcmexico.org/contests/final',
      contentType: 'text/html',
      redirects: 1,
    });
    if (result.status === 'fetched') {
      expect(new TextDecoder().decode(result.body)).toBe('standings');
      expect(result.contentSha256).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('blocks external redirects before requesting their destinations', async () => {
    const request = fetchMock(
      () =>
        new ResponseConstructor(null, {
          status: 302,
          headers: { location: 'https://example.com/redirected' },
        }),
    );
    const fetcher = new BoundedSourceFetcher(source, { ...options, fetchImpl: request });
    await expect(fetcher.fetch('https://icpcmexico.org/start')).resolves.toMatchObject({
      status: 'failed',
      kind: 'redirect-blocked',
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('reports HTTP, timeout, request-budget, and redirect-limit failures distinctly', async () => {
    const httpFetcher = new BoundedSourceFetcher(source, {
      ...options,
      fetchImpl: fetchMock(() => new ResponseConstructor('unavailable', { status: 503 })),
    });
    await expect(httpFetcher.fetch('https://icpcmexico.org/fail')).resolves.toMatchObject({
      status: 'failed',
      kind: 'http',
      httpStatus: 503,
    });

    const timeoutError = new DOMException('request timed out', 'TimeoutError');
    const timeoutFetcher = new BoundedSourceFetcher(source, {
      ...options,
      fetchImpl: fetchMock(() => Promise.reject(timeoutError)),
    });
    await expect(timeoutFetcher.fetch('https://icpcmexico.org/slow')).resolves.toMatchObject({
      status: 'failed',
      kind: 'timeout',
    });

    const budgetFetcher = new BoundedSourceFetcher(source, {
      ...options,
      maxRequests: 1,
      fetchImpl: fetchMock(() => response('ok')),
    });
    await budgetFetcher.fetch('https://icpcmexico.org/one');
    await expect(budgetFetcher.fetch('https://icpcmexico.org/two')).resolves.toMatchObject({
      status: 'failed',
      kind: 'request-budget-exceeded',
    });

    const redirectFetcher = new BoundedSourceFetcher(source, {
      ...options,
      maxRedirects: 0,
      fetchImpl: fetchMock(
        () =>
          new ResponseConstructor(null, {
            status: 302,
            headers: { location: '/next' },
          }),
      ),
    });
    await expect(redirectFetcher.fetch('https://icpcmexico.org/start')).resolves.toMatchObject({
      status: 'failed',
      kind: 'redirect-limit',
    });
  });

  it('rejects oversized declared and streamed response bodies', async () => {
    const declaredFetcher = new BoundedSourceFetcher(source, {
      ...options,
      fetchImpl: fetchMock(() => response('123456789', { 'content-length': '100' })),
    });
    await expect(declaredFetcher.fetch('https://icpcmexico.org/large')).resolves.toMatchObject({
      status: 'failed',
      kind: 'response-too-large',
    });

    const streamedFetcher = new BoundedSourceFetcher(source, {
      ...options,
      fetchImpl: fetchMock(() => response('12345678901234567890')),
    });
    await expect(streamedFetcher.fetch('https://icpcmexico.org/stream')).resolves.toMatchObject({
      status: 'failed',
      kind: 'response-too-large',
    });
  });

  it('enforces safe constructor limits', () => {
    expect(() => new BoundedSourceFetcher(source, { ...options, timeoutMs: 60_001 })).toThrow(
      RangeError,
    );
    expect(() => new BoundedSourceFetcher(source, { ...options, maxResponseBytes: 0 })).toThrow(
      RangeError,
    );
    expect(() => new BoundedSourceFetcher(source, { ...options, maxRequests: 1001 })).toThrow(
      RangeError,
    );
    expect(() => new BoundedSourceFetcher(source, { ...options, maxRedirects: 6 })).toThrow(
      RangeError,
    );
  });
});
