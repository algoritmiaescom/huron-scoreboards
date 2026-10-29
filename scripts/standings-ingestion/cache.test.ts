import { mkdtemp, readdir, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { BoundedJsonCache, createParseCacheKey, stableSerialize } from './cache';

const cacheSchema = z.object({ value: z.string() });

const createCache = async (
  options: { maxEntries?: number; ttlMs?: number; maxEntryBytes?: number } = {},
) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'huron-standings-cache-'));
  const cache = new BoundedJsonCache({
    directory,
    maxEntries: options.maxEntries ?? 10,
    ttlMs: options.ttlMs ?? 60_000,
    maxEntryBytes: options.maxEntryBytes ?? 1024,
  });
  return { cache, directory };
};

describe('standings parse cache', () => {
  it('canonicalizes object keys and includes parser/model settings in cache identity', () => {
    expect(stableSerialize({ z: 1, a: { y: true, x: null } })).toBe(
      '{"a":{"x":null,"y":true},"z":1}',
    );
    const base = {
      contentSha256: 'a'.repeat(64),
      parserVersion: 'parser-v1',
      promptVersion: 'prompt-v1',
      model: 'model-v1',
      options: { temperature: 0, seed: 42 },
    };
    expect(createParseCacheKey(base)).toBe(
      createParseCacheKey({
        ...base,
        options: { seed: 42, temperature: 0 },
      }),
    );
    expect(createParseCacheKey(base)).not.toBe(
      createParseCacheKey({ ...base, parserVersion: 'parser-v2' }),
    );
    expect(createParseCacheKey(base)).not.toBe(createParseCacheKey({ ...base, model: 'model-v2' }));
    expect(() => stableSerialize({ value: Number.POSITIVE_INFINITY })).toThrow();
    expect(() => createParseCacheKey({ ...base, contentSha256: 'bad' })).toThrow(/SHA-256/);
  });

  it('stores, validates, and treats schema mismatch as a cache miss', async () => {
    const { cache, directory } = await createCache();
    try {
      const key = createParseCacheKey({
        contentSha256: 'b'.repeat(64),
        parserVersion: 'v1',
        promptVersion: null,
        model: null,
        options: {},
      });
      expect(await cache.get(key, cacheSchema)).toBeUndefined();
      expect(await cache.set(key, { value: 'parsed' })).toBe(true);
      expect(await cache.get(key, cacheSchema)).toEqual({ value: 'parsed' });
      expect(await cache.get(key, z.object({ count: z.number() }))).toBeUndefined();
      expect(await readdir(directory)).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('expires stale entries and enforces the configured entry and size bounds', async () => {
    const { cache, directory } = await createCache({
      maxEntries: 1,
      ttlMs: 1000,
      maxEntryBytes: 16,
    });
    try {
      const firstKey = '1'.repeat(64);
      const secondKey = '2'.repeat(64);
      const firstPath = path.join(directory, `${firstKey}.json`);
      expect(await cache.set(firstKey, { value: 'one' })).toBe(true);
      await utimes(firstPath, new Date(0), new Date(0));
      expect(await cache.get(firstKey, cacheSchema)).toBeUndefined();
      expect(await cache.set(firstKey, { value: 'one' })).toBe(true);
      expect(await cache.set(secondKey, { value: 'two' })).toBe(true);
      expect((await readdir(directory)).filter((name) => name.endsWith('.json'))).toHaveLength(1);
      expect(await cache.set('3'.repeat(64), { value: 'this entry cannot fit' })).toBe(false);
      await expect(cache.get('../outside', cacheSchema)).rejects.toThrow(/SHA-256/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
