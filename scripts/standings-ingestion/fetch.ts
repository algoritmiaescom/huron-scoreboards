import { createHash } from 'node:crypto';

import { sourceDefinitionSchema } from '@/features/scoreboards/ingestion/schemas';

import type { SourceDefinition } from '@/features/scoreboards/ingestion/schemas';
import type { RequestInit, Response } from 'undici-types';

type FetchFailureKind =
  | 'invalid-url'
  | 'request-budget-exceeded'
  | 'timeout'
  | 'network'
  | 'http'
  | 'redirect-limit'
  | 'redirect-blocked'
  | 'response-too-large'
  | 'response-read';

export type SourceFetchResult =
  | {
      status: 'fetched';
      sourceId: string;
      discoveryUrl: string;
      finalUrl: string;
      httpStatus: number;
      contentType: string | null;
      body: Uint8Array;
      contentSha256: string;
      redirects: number;
    }
  | {
      status: 'failed';
      sourceId: string;
      url: string;
      kind: FetchFailureKind;
      message: string;
      httpStatus?: number;
    };

export interface SourceFetcherOptions {
  timeoutMs: number;
  maxResponseBytes: number;
  maxRequests: number;
  maxRedirects: number;
  fetchImpl?: SourceFetchImplementation;
}

export type SourceFetchImplementation = (input: string, init: RequestInit) => Promise<Response>;

interface ByteStreamReader {
  read: () => Promise<{ done: boolean; value: Uint8Array | undefined }>;
  cancel: () => Promise<void>;
  releaseLock: () => void;
}

interface ByteStream {
  getReader: () => ByteStreamReader;
  cancel: () => Promise<void>;
}

const MAX_TIMEOUT_MS = 60_000;
const MAX_RESPONSE_BYTES = 64 * 1024 * 1024;
const MAX_REQUESTS = 1000;
const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const isRedirect = (status: number): boolean => REDIRECT_STATUSES.has(status);

const isTimeoutError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'name' in error &&
  (error.name === 'TimeoutError' || error.name === 'AbortError');

const isValidTarget = (value: string, origin: string): URL | undefined => {
  try {
    const target = new URL(value);
    if (
      target.protocol !== 'https:' ||
      target.origin !== origin ||
      target.username.length > 0 ||
      target.password.length > 0
    ) {
      return undefined;
    }
    target.hash = '';
    return target;
  } catch {
    return undefined;
  }
};

const contentLengthExceeds = (response: Response, maxBytes: number): boolean => {
  const header = response.headers.get('content-length');
  if (header === null || !/^\d+$/.test(header)) {
    return false;
  }
  return Number(header) > maxBytes;
};

const responseBody = (response: Response): ByteStream | null => {
  const body: unknown = (response as unknown as { body: unknown }).body;
  if (body === null || body === undefined) {
    return null;
  }
  return body as ByteStream;
};

const readBoundedBody = async (
  response: Response,
  maxBytes: number,
): Promise<Uint8Array | 'too-large'> => {
  const bodyStream = responseBody(response);
  if (bodyStream === null) {
    return new Uint8Array();
  }
  const reader = bodyStream.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value === undefined) {
        continue;
      }
      byteLength += value.byteLength;
      if (byteLength > maxBytes) {
        await reader.cancel();
        return 'too-large';
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(byteLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return body;
};

export class BoundedSourceFetcher {
  private readonly source: SourceDefinition;
  private readonly origin: string;
  private readonly timeoutMs: number;
  private readonly maxResponseBytes: number;
  private readonly maxRequests: number;
  private readonly maxRedirects: number;
  private readonly fetchImpl: SourceFetchImplementation;
  private requestCount = 0;

  constructor(source: SourceDefinition, options: SourceFetcherOptions) {
    this.source = sourceDefinitionSchema.parse(source);
    this.origin = new URL(this.source.baseUrl).origin;
    if (
      !Number.isSafeInteger(options.timeoutMs) ||
      options.timeoutMs < 1 ||
      options.timeoutMs > MAX_TIMEOUT_MS
    ) {
      throw new RangeError(
        `Fetch timeout must be between 1 and ${String(MAX_TIMEOUT_MS)} milliseconds.`,
      );
    }
    if (
      !Number.isSafeInteger(options.maxResponseBytes) ||
      options.maxResponseBytes < 1 ||
      options.maxResponseBytes > MAX_RESPONSE_BYTES
    ) {
      throw new RangeError(
        `Response size must be between 1 and ${String(MAX_RESPONSE_BYTES)} bytes.`,
      );
    }
    if (
      !Number.isSafeInteger(options.maxRequests) ||
      options.maxRequests < 1 ||
      options.maxRequests > MAX_REQUESTS
    ) {
      throw new RangeError(`Request budget must be between 1 and ${String(MAX_REQUESTS)}.`);
    }
    if (
      !Number.isSafeInteger(options.maxRedirects) ||
      options.maxRedirects < 0 ||
      options.maxRedirects > MAX_REDIRECTS
    ) {
      throw new RangeError(`Redirect limit must be between 0 and ${String(MAX_REDIRECTS)}.`);
    }
    this.timeoutMs = options.timeoutMs;
    this.maxResponseBytes = options.maxResponseBytes;
    this.maxRequests = options.maxRequests;
    this.maxRedirects = options.maxRedirects;
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  fetch = async (targetUrl: string): Promise<SourceFetchResult> => {
    const discoveryUrl = targetUrl;
    let target = isValidTarget(targetUrl, this.origin);
    if (target === undefined) {
      return this.failure(
        targetUrl,
        'invalid-url',
        'URL must use the configured source origin over HTTPS.',
      );
    }
    let redirects = 0;

    for (;;) {
      if (this.requestCount >= this.maxRequests) {
        return this.failure(
          target.href,
          'request-budget-exceeded',
          'Source request budget exhausted.',
        );
      }
      this.requestCount += 1;
      let response: Response;
      try {
        response = await this.fetchImpl(target.href, {
          method: 'GET',
          redirect: 'manual',
          signal: AbortSignal.timeout(this.timeoutMs),
          headers: { accept: '*/*' },
        });
      } catch (error) {
        return this.failure(
          target.href,
          isTimeoutError(error) ? 'timeout' : 'network',
          error instanceof Error ? error.message : 'Source request failed.',
        );
      }

      if (isRedirect(response.status)) {
        const body = responseBody(response);
        if (body !== null) {
          await body.cancel();
        }
        if (redirects >= this.maxRedirects) {
          return this.failure(
            target.href,
            'redirect-limit',
            'Source redirect limit exceeded.',
            response.status,
          );
        }
        const location = response.headers.get('location');
        if (location === null) {
          return this.failure(
            target.href,
            'redirect-blocked',
            'Redirect omitted its destination.',
            response.status,
          );
        }
        const nextTarget = isValidTarget(new URL(location, target).href, this.origin);
        if (nextTarget === undefined) {
          return this.failure(
            target.href,
            'redirect-blocked',
            'Redirect left the configured source origin.',
            response.status,
          );
        }
        redirects += 1;
        target = nextTarget;
        continue;
      }

      if (!response.ok) {
        const body = responseBody(response);
        if (body !== null) {
          await body.cancel();
        }
        return this.failure(
          target.href,
          'http',
          `Source returned HTTP ${String(response.status)}.`,
          response.status,
        );
      }
      if (contentLengthExceeds(response, this.maxResponseBytes)) {
        const body = responseBody(response);
        if (body !== null) {
          await body.cancel();
        }
        return this.failure(
          target.href,
          'response-too-large',
          'Source response exceeds the configured byte limit.',
          response.status,
        );
      }

      let body: Uint8Array | 'too-large';
      try {
        body = await readBoundedBody(response, this.maxResponseBytes);
      } catch (error) {
        return this.failure(
          target.href,
          isTimeoutError(error) ? 'timeout' : 'response-read',
          error instanceof Error ? error.message : 'Could not read source response.',
          response.status,
        );
      }
      if (body === 'too-large') {
        return this.failure(
          target.href,
          'response-too-large',
          'Source response exceeds the configured byte limit.',
          response.status,
        );
      }
      return {
        status: 'fetched',
        sourceId: this.source.id,
        discoveryUrl,
        finalUrl: target.href,
        httpStatus: response.status,
        contentType: response.headers.get('content-type')?.split(';', 1)[0].trim() ?? null,
        body,
        contentSha256: createHash('sha256').update(body).digest('hex'),
        redirects,
      };
    }
  };

  private failure = (
    url: string,
    kind: FetchFailureKind,
    message: string,
    httpStatus?: number,
  ): SourceFetchResult => ({
    status: 'failed',
    sourceId: this.source.id,
    url,
    kind,
    message,
    ...(httpStatus === undefined ? {} : { httpStatus }),
  });
}
