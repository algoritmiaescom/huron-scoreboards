import { createParseCacheKey } from './cache';

import type { BoundedJsonCache, ParseCacheIdentity } from './cache';
import type { SourceFetchResult } from './fetch';
import type { ZodType } from 'zod';

export class ParsedOutputValidationError extends Error {
  readonly issues: unknown;

  constructor(issues: unknown) {
    super('Cached parser output did not match its validation schema.');
    this.name = 'ParsedOutputValidationError';
    this.issues = issues;
  }
}

export interface CachedParseResult<T> {
  status: 'parsed';
  cache: 'hit' | 'miss';
  cacheKey: string;
  data: T;
}

export const parseFetchedContent = async <T>({
  response,
  identity,
  cache,
  schema,
  parse,
}: {
  response: Extract<SourceFetchResult, { status: 'fetched' }>;
  identity: Omit<ParseCacheIdentity, 'contentSha256'>;
  cache: BoundedJsonCache;
  schema: ZodType<T>;
  parse: (body: Uint8Array) => Promise<unknown>;
}): Promise<CachedParseResult<T>> => {
  const cacheKey = createParseCacheKey({
    ...identity,
    contentSha256: response.contentSha256,
  });
  const cached = await cache.get(cacheKey, schema);
  if (cached !== undefined) {
    return { status: 'parsed', cache: 'hit', cacheKey, data: cached };
  }

  const parsedOutput = await parse(response.body);
  const validated = schema.safeParse(parsedOutput);
  if (!validated.success) {
    throw new ParsedOutputValidationError(validated.error.issues);
  }
  await cache.set(cacheKey, validated.data);
  return { status: 'parsed', cache: 'miss', cacheKey, data: validated.data };
};
