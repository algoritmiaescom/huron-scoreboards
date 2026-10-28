import { issuesFromZodError, type ValidationIssue } from '@/lib/validation/issues';

import type { ZodType } from 'zod';

export type JsonFiles = Record<string, () => Promise<string>>;
export type DatasetSource = 'archive' | 'mock';

export type RepositoryResult<T> =
  | { status: 'ready' | 'empty'; data: T }
  | { status: 'invalid'; issues: ValidationIssue[] }
  | { status: 'error'; issues: ValidationIssue[] };

export type RecordResult<T> = { status: 'found'; record: T } | { status: 'not-found' };

export const findRecord = <T>(record: T | undefined): RecordResult<T> =>
  record === undefined ? { status: 'not-found' } : { status: 'found', record };

export const datasetPath = (source: DatasetSource): string =>
  source === 'archive' ? 'data/' : 'data/mock/';

export const relativeDataPath = (file: string, source: DatasetSource): string | undefined => {
  const normalized = file.replace(/^\//, '');
  const root = datasetPath(source);
  if (!normalized.startsWith(root)) {
    return undefined;
  }
  const relative = normalized.slice(root.length);
  return relative.startsWith('mock/') ? undefined : relative;
};

export const loadJsonFile = async <T>(
  file: string,
  load: () => Promise<string>,
  schema: ZodType<T>,
): Promise<RepositoryResult<T>> => {
  let contents: string;
  try {
    contents = await load();
  } catch (error) {
    return {
      status: 'error',
      issues: [{ file, location: '', message: `could not be loaded: ${String(error)}` }],
    };
  }

  let json: unknown;
  try {
    json = JSON.parse(contents);
  } catch (error) {
    return {
      status: 'invalid',
      issues: [{ file, location: '', message: `is not valid JSON: ${String(error)}` }],
    };
  }
  const parsed = schema.safeParse(json);
  return parsed.success
    ? { status: 'ready', data: parsed.data }
    : { status: 'invalid', issues: issuesFromZodError(file, parsed.error) };
};
