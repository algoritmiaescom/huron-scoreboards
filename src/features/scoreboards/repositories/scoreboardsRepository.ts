import {
  type ScoreboardsDataset,
  validateScoreboardsReferences,
} from '@/features/scoreboards/model/dataset';
import {
  type Contest,
  contestSchema,
  type School,
  schoolsFileSchema,
  type SeasonStanding,
  seasonStandingSchema,
  type Team,
  teamsFileSchema,
} from '@/features/scoreboards/model/schemas';
import {
  type DatasetSource,
  type JsonFiles,
  loadJsonFile,
  relativeDataPath,
  type RepositoryResult,
} from '@/lib/data/repository';

import type { ValidationIssue } from '@/lib/validation/issues';
import type { ZodType } from 'zod';

export interface ScoreboardsArchive {
  source: DatasetSource;
  schools: School[];
  teams: Team[];
  contests: Contest[];
  seasonStandings: SeasonStanding[];
}

export interface ScoreboardsRepository {
  load: () => Promise<RepositoryResult<ScoreboardsArchive>>;
}

export const createJsonScoreboardsRepository = (
  files: JsonFiles,
  source: DatasetSource,
): ScoreboardsRepository => ({
  load: async () => {
    const dataset: ScoreboardsDataset = {
      schools: [],
      teams: [],
      contests: [],
      seasonStandings: [],
    };
    const issues: ValidationIssue[] = [];
    const failures: ('invalid' | 'error')[] = [];

    const parse = async <T>(
      file: string,
      load: () => Promise<string>,
      schema: ZodType<T>,
      accept: (record: T) => void,
    ) => {
      const result = await loadJsonFile(file, load, schema);
      if (result.status === 'invalid' || result.status === 'error') {
        issues.push(...result.issues);
        failures.push(result.status);
      } else {
        accept(result.data);
      }
    };

    await Promise.all(
      Object.entries(files).map(async ([file, load]) => {
        const relative = relativeDataPath(file, source);
        if (relative === undefined || relative.startsWith('media/')) {
          return;
        }
        if (relative === 'schools.json') {
          await parse(file, load, schoolsFileSchema, (record) => {
            dataset.schools.push({ file, record });
          });
          return;
        }
        const teams = /^seasons\/(\d{4})\/teams\.json$/.exec(relative);
        if (teams) {
          await parse(file, load, teamsFileSchema, (record) => {
            dataset.teams.push({ file, record, location: { seasonYear: Number(teams[1]) } });
          });
          return;
        }
        const contest = /^seasons\/(\d{4})\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([^/]+)\.json$/.exec(
          relative,
        );
        if (contest) {
          const location = { seasonYear: Number(contest[1]), seriesId: contest[2] };
          if (contest[3] === 'standing') {
            await parse(file, load, seasonStandingSchema, (record) => {
              dataset.seasonStandings.push({ file, record, location });
            });
          } else {
            await parse(file, load, contestSchema, (record) => {
              dataset.contests.push({ file, record, location });
            });
          }
          return;
        }
        issues.push({ file, location: '', message: 'unrecognized scoreboard data path' });
      }),
    );
    issues.push(...validateScoreboardsReferences(dataset));
    if (issues.length > 0) {
      return { status: failures.includes('error') ? 'error' : 'invalid', issues };
    }
    const data: ScoreboardsArchive = {
      source,
      schools: dataset.schools
        .flatMap(({ record }) => record)
        .sort((a, b) => a.id.localeCompare(b.id)),
      teams: dataset.teams.flatMap(({ record }) => record).sort((a, b) => a.id.localeCompare(b.id)),
      contests: dataset.contests
        .map(({ record }) => record)
        .sort((a, b) => a.id.localeCompare(b.id)),
      seasonStandings: dataset.seasonStandings
        .map(({ record }) => record)
        .sort((a, b) => b.seasonYear - a.seasonYear || a.seriesId.localeCompare(b.seriesId)),
    };
    return {
      status:
        data.schools.length +
          data.teams.length +
          data.contests.length +
          data.seasonStandings.length ===
        0
          ? 'empty'
          : 'ready',
      data,
    };
  },
});
