import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { BoundedJsonCache } from './cache';
import { ParsedOutputValidationError, parseFetchedContent } from './parse-cache';

const schema = z.object({ text: z.string() });
const response = {
  status: 'fetched' as const,
  sourceId: 'icpc-mexico',
  discoveryUrl: 'https://icpcmexico.org/contests',
  finalUrl: 'https://icpcmexico.org/result',
  httpStatus: 200,
  contentType: 'text/html',
  body: new TextEncoder().encode('<p>results</p>'),
  contentSha256: 'a'.repeat(64),
  redirects: 0,
};
const identity = {
  parserVersion: 'parser-v1',
  promptVersion: 'prompt-v1',
  model: 'model-v1',
  options: { temperature: 0 },
};

const createCache = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'huron-parse-cache-'));
  return {
    directory,
    cache: new BoundedJsonCache({
      directory,
      maxEntries: 10,
      maxEntryBytes: 1024,
      ttlMs: 60_000,
    }),
  };
};

describe('cached source parsing', () => {
  it('caches validated parser results by content and parser/model settings', async () => {
    const { cache, directory } = await createCache();
    const parse = vi.fn(() => Promise.resolve({ text: 'parsed' }));
    try {
      const first = await parseFetchedContent({ response, identity, cache, schema, parse });
      const second = await parseFetchedContent({ response, identity, cache, schema, parse });
      const newPrompt = await parseFetchedContent({
        response,
        identity: { ...identity, promptVersion: 'prompt-v2' },
        cache,
        schema,
        parse,
      });
      const changedContent = await parseFetchedContent({
        response: { ...response, contentSha256: 'b'.repeat(64) },
        identity,
        cache,
        schema,
        parse,
      });
      expect(first.cache).toBe('miss');
      expect(second.cache).toBe('hit');
      expect(newPrompt.cache).toBe('miss');
      expect(changedContent.cache).toBe('miss');
      expect(parse).toHaveBeenCalledTimes(3);
      expect(second.data).toEqual({ text: 'parsed' });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('does not cache parser output that fails the candidate schema', async () => {
    const { cache, directory } = await createCache();
    const parse = vi.fn(() => Promise.resolve({ text: 42 }));
    try {
      await expect(
        parseFetchedContent({ response, identity, cache, schema, parse }),
      ).rejects.toBeInstanceOf(ParsedOutputValidationError);
      await expect(
        parseFetchedContent({ response, identity, cache, schema, parse }),
      ).rejects.toBeInstanceOf(ParsedOutputValidationError);
      expect(parse).toHaveBeenCalledTimes(2);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
