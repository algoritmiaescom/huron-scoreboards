import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { validateMediaReferences, type MediaDataset } from '@/features/media/model/dataset';
import { eventFileSchema } from '@/features/media/model/schemas';
import {
  validateScoreboardsReferences,
  type ScoreboardsDataset,
} from '@/features/scoreboards/model/dataset';
import {
  contestSchema,
  isRemoteLogo,
  schoolsFileSchema,
  seasonStandingSchema,
  teamsFileSchema,
} from '@/features/scoreboards/model/schemas';
import { issuesFromZodError, type ValidationIssue } from '@/lib/validation/issues';

import type { ZodType } from 'zod';

export interface ValidationReport {
  issues: ValidationIssue[];
  /** Number of data files that were read, so a vacuous pass is visible rather than silent. */
  fileCount: number;
}

const SEASON_STANDING_FILENAME = 'standing.json';
const TEAMS_FILENAME = 'teams.json';
const SCHOOLS_FILENAME = 'schools.json';

const toPosixPath = (value: string): string => value.split(path.sep).join('/');

const listEntries = async (directory: string) => {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
};

const directoryExists = async (directory: string): Promise<boolean> => {
  try {
    await readdir(directory);
    return true;
  } catch {
    return false;
  }
};

interface ParseResult<T> {
  record: T;
  issues: ValidationIssue[];
}

const parseFile = async <T>(
  root: string,
  absolutePath: string,
  schema: ZodType<T>,
): Promise<ParseResult<T | undefined>> => {
  const file = toPosixPath(path.relative(root, absolutePath));
  let contents: string;

  try {
    contents = await readFile(absolutePath, 'utf8');
  } catch {
    return {
      record: undefined,
      issues: [{ file, location: '', message: 'could not be read' }],
    };
  }

  let json: unknown;

  try {
    json = JSON.parse(contents);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown error';

    return {
      record: undefined,
      issues: [{ file, location: '', message: `is not valid JSON: ${detail}` }],
    };
  }

  const result = schema.safeParse(json);

  if (!result.success) {
    return { record: undefined, issues: issuesFromZodError(file, result.error) };
  }

  return { record: result.data, issues: [] };
};

const loadSeasons = async (
  root: string,
  dataDirectory: string,
): Promise<{ dataset: ScoreboardsDataset; issues: ValidationIssue[]; fileCount: number }> => {
  const dataset: ScoreboardsDataset = {
    schools: [],
    teams: [],
    contests: [],
    seasonStandings: [],
  };
  const issues: ValidationIssue[] = [];
  let fileCount = 0;

  const schoolsPath = path.join(dataDirectory, SCHOOLS_FILENAME);
  const schoolEntries = await listEntries(dataDirectory);
  const hasSchoolsFile = schoolEntries.some(
    (entry) => entry.isFile() && entry.name === SCHOOLS_FILENAME,
  );

  if (hasSchoolsFile) {
    fileCount += 1;
    const parsed = await parseFile(root, schoolsPath, schoolsFileSchema);
    issues.push(...parsed.issues);

    if (parsed.record !== undefined) {
      dataset.schools.push({
        file: toPosixPath(path.relative(root, schoolsPath)),
        record: parsed.record,
      });
    }
  }

  const seasonsDirectory = path.join(dataDirectory, 'seasons');

  for (const seasonEntry of await listEntries(seasonsDirectory)) {
    if (!seasonEntry.isDirectory()) {
      continue;
    }

    const seasonDirectory = path.join(seasonsDirectory, seasonEntry.name);
    const seasonYear = Number(seasonEntry.name);

    if (!Number.isInteger(seasonYear)) {
      issues.push({
        file: toPosixPath(path.relative(root, seasonDirectory)),
        location: '',
        message: 'season directories must be named after a year, such as `2024`',
      });
      continue;
    }

    for (const entry of await listEntries(seasonDirectory)) {
      const entryPath = path.join(seasonDirectory, entry.name);

      if (entry.isFile() && entry.name === TEAMS_FILENAME) {
        fileCount += 1;
        const parsed = await parseFile(root, entryPath, teamsFileSchema);
        issues.push(...parsed.issues);

        if (parsed.record !== undefined) {
          dataset.teams.push({
            file: toPosixPath(path.relative(root, entryPath)),
            record: parsed.record,
          });
        }

        continue;
      }

      if (!entry.isDirectory()) {
        continue;
      }

      const seriesId = entry.name;

      for (const contestEntry of await listEntries(entryPath)) {
        if (!contestEntry.isFile() || !contestEntry.name.endsWith('.json')) {
          continue;
        }

        const contestPath = path.join(entryPath, contestEntry.name);
        const file = toPosixPath(path.relative(root, contestPath));
        const location = { seasonYear, seriesId };
        fileCount += 1;

        if (contestEntry.name === SEASON_STANDING_FILENAME) {
          const parsed = await parseFile(root, contestPath, seasonStandingSchema);
          issues.push(...parsed.issues);

          if (parsed.record !== undefined) {
            dataset.seasonStandings.push({ file, record: parsed.record, location });
          }

          continue;
        }

        const parsed = await parseFile(root, contestPath, contestSchema);
        issues.push(...parsed.issues);

        if (parsed.record !== undefined) {
          dataset.contests.push({ file, record: parsed.record, location });
        }
      }
    }
  }

  return { dataset, issues, fileCount };
};

const loadMedia = async (
  root: string,
  dataDirectory: string,
): Promise<{ dataset: MediaDataset; issues: ValidationIssue[]; fileCount: number }> => {
  const dataset: MediaDataset = { events: [] };
  const issues: ValidationIssue[] = [];
  let fileCount = 0;
  const eventsDirectory = path.join(dataDirectory, 'media', 'events');

  for (const entry of await listEntries(eventsDirectory)) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }

    const eventPath = path.join(eventsDirectory, entry.name);
    fileCount += 1;
    const parsed = await parseFile(root, eventPath, eventFileSchema);
    issues.push(...parsed.issues);

    if (parsed.record !== undefined) {
      dataset.events.push({
        file: toPosixPath(path.relative(root, eventPath)),
        record: parsed.record,
      });
    }
  }

  return { dataset, issues, fileCount };
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    const stats = await stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
};

/**
 * Committed logos are checked against the filesystem, which the shared validators cannot do: they
 * also run in the browser. Remote logos are left alone because reaching them needs the network.
 */
const validateLogoFiles = async (
  root: string,
  dataset: ScoreboardsDataset,
): Promise<ValidationIssue[]> => {
  const issues: ValidationIssue[] = [];

  for (const { file, record } of dataset.schools) {
    for (const [index, school] of record.entries()) {
      const { logo } = school;

      if (logo === undefined || isRemoteLogo(logo)) {
        continue;
      }

      if (!(await fileExists(path.join(root, 'public', logo)))) {
        issues.push({
          file,
          location: `[${String(index)}].logo`,
          message: `logo file \`public/${logo}\` does not exist`,
        });
      }
    }
  }

  return issues;
};

/**
 * Reads every data file in a dataset directory, validates each against its schema, then runs the
 * cross-file reference checks. All failures are collected so a contributor sees them at once.
 *
 * References are resolved within a single dataset, so each root is validated independently: mock
 * teams resolve against mock schools and never against the real archive.
 *
 * @param root Repository root, used to report file paths relative to it.
 * @param dataDirectory Dataset directory to read. Defaults to `<root>/data`.
 */
export const validateDataDirectory = async (
  root: string,
  dataDirectory: string = path.join(root, 'data'),
): Promise<ValidationReport> => {
  if (!(await directoryExists(dataDirectory))) {
    return { issues: [], fileCount: 0 };
  }

  const scoreboards = await loadSeasons(root, dataDirectory);
  const media = await loadMedia(root, dataDirectory);
  const contestIds = new Set(scoreboards.dataset.contests.map(({ record }) => record.id));

  return {
    issues: [
      ...scoreboards.issues,
      ...media.issues,
      ...validateScoreboardsReferences(scoreboards.dataset),
      ...validateMediaReferences(media.dataset, contestIds),
      ...(await validateLogoFiles(root, scoreboards.dataset)),
    ],
    fileCount: scoreboards.fileCount + media.fileCount,
  };
};
