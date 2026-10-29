import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import type { ZodType } from 'zod';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MAX_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 1000;
const MAX_ENTRY_BYTES = 64 * 1024 * 1024;

const jsonValueSchema = z.json();
type JsonValue = z.infer<typeof jsonValueSchema>;

const canonicalize = (value: JsonValue): JsonValue => {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .toSorted((left, right) => left.localeCompare(right))
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
};

export const stableSerialize = (value: unknown): string =>
  JSON.stringify(canonicalize(jsonValueSchema.parse(value)));

export interface ParseCacheIdentity {
  contentSha256: string;
  parserVersion: string;
  promptVersion: string | null;
  model: string | null;
  options: unknown;
}

export const createParseCacheKey = (identity: ParseCacheIdentity): string => {
  if (!SHA256_PATTERN.test(identity.contentSha256)) {
    throw new TypeError('Cache identity requires a lowercase SHA-256 content hash.');
  }
  return createHash('sha256').update(stableSerialize(identity)).digest('hex');
};

export interface JsonCacheOptions {
  directory: string;
  ttlMs: number;
  maxEntries: number;
  maxEntryBytes: number;
}

export class BoundedJsonCache {
  private readonly directory: string;
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly maxEntryBytes: number;

  constructor(options: JsonCacheOptions) {
    if (!Number.isSafeInteger(options.ttlMs) || options.ttlMs < 1 || options.ttlMs > MAX_TTL_MS) {
      throw new RangeError(`Cache TTL must be between 1 and ${String(MAX_TTL_MS)} milliseconds.`);
    }
    if (
      !Number.isSafeInteger(options.maxEntries) ||
      options.maxEntries < 1 ||
      options.maxEntries > MAX_CACHE_ENTRIES
    ) {
      throw new RangeError(`Cache entry limit must be between 1 and ${String(MAX_CACHE_ENTRIES)}.`);
    }
    if (
      !Number.isSafeInteger(options.maxEntryBytes) ||
      options.maxEntryBytes < 1 ||
      options.maxEntryBytes > MAX_ENTRY_BYTES
    ) {
      throw new RangeError(
        `Cache entry size must be between 1 and ${String(MAX_ENTRY_BYTES)} bytes.`,
      );
    }
    this.directory = path.resolve(options.directory);
    this.ttlMs = options.ttlMs;
    this.maxEntries = options.maxEntries;
    this.maxEntryBytes = options.maxEntryBytes;
  }

  get = async <T>(key: string, schema: ZodType<T>): Promise<T | undefined> => {
    const file = this.filePath(key);
    let fileStats;
    try {
      fileStats = await stat(file);
    } catch (error) {
      if (this.isMissing(error)) {
        return undefined;
      }
      throw error;
    }
    if (!fileStats.isFile() || fileStats.size > this.maxEntryBytes) {
      await this.remove(file);
      return undefined;
    }
    if (Date.now() - fileStats.mtimeMs > this.ttlMs) {
      await this.remove(file);
      return undefined;
    }
    const content = await readFile(file, 'utf8');
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(content) as unknown;
    } catch {
      await this.remove(file);
      return undefined;
    }
    const parsed = schema.safeParse(parsedJson);
    if (!parsed.success) {
      await this.remove(file);
      return undefined;
    }
    return parsed.data;
  };

  set = async (key: string, value: unknown): Promise<boolean> => {
    const content = stableSerialize(value);
    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes > this.maxEntryBytes) {
      return false;
    }
    await mkdir(this.directory, { recursive: true });
    const destination = this.filePath(key);
    const temporary = path.join(this.directory, `.${key}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, content, { encoding: 'utf8', flag: 'wx' });
      await rename(temporary, destination);
    } finally {
      await this.remove(temporary);
    }
    await this.prune(key);
    return true;
  };

  private filePath = (key: string): string => {
    if (!SHA256_PATTERN.test(key)) {
      throw new TypeError('Cache keys must be lowercase SHA-256 hashes.');
    }
    return path.join(this.directory, `${key}.json`);
  };

  private isMissing = (error: unknown): boolean =>
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';

  private remove = async (file: string): Promise<void> => {
    try {
      await unlink(file);
    } catch (error) {
      if (!this.isMissing(error)) {
        throw error;
      }
    }
  };

  private prune = async (preserveKey: string): Promise<void> => {
    const entries = await readdir(this.directory, { withFileTypes: true });
    const cacheFiles = await Promise.all(
      entries.flatMap((entry) => {
        const match = /^([a-f0-9]{64})\.json$/.exec(entry.name);
        if (!entry.isFile() || match === null) {
          return [];
        }
        const file = path.join(this.directory, entry.name);
        return [
          stat(file).then((fileStats) => ({ key: match[1], file, mtimeMs: fileStats.mtimeMs })),
        ];
      }),
    );
    const expired = cacheFiles.filter(({ mtimeMs }) => Date.now() - mtimeMs > this.ttlMs);
    await Promise.all(expired.map(({ file }) => this.remove(file)));
    const retained = cacheFiles
      .filter(({ mtimeMs }) => Date.now() - mtimeMs <= this.ttlMs)
      .toSorted((left, right) => left.mtimeMs - right.mtimeMs);
    let excess = Math.max(0, retained.length - this.maxEntries);
    const removeEntries = retained.filter(({ key }) => {
      if (key === preserveKey || excess === 0) {
        return false;
      }
      excess -= 1;
      return true;
    });
    await Promise.all(removeEntries.map(({ file }) => this.remove(file)));
  };
}
