import {
  type ScoreboardsDataset,
  validateScoreboardsReferences,
} from '@/features/scoreboards/model/dataset';
import {
  type Contest,
  contestCatalogEntrySchema,
  contestSchema,
  type School,
  schoolsFileSchema,
  type ScoreboardsCatalog,
  type SeasonStanding,
  seasonStandingCatalogEntrySchema,
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
  catalog?: ScoreboardsCatalog;
}

export interface ScoreboardsRepository {
  load: () => Promise<RepositoryResult<ScoreboardsArchive>>;
  loadSeason: (seasonYear: number) => Promise<RepositoryResult<ScoreboardsArchive>>;
}

export const createJsonScoreboardsRepository = (
  files: JsonFiles,
  source: DatasetSource,
  catalog?: ScoreboardsCatalog,
): ScoreboardsRepository => {
  const loadArchive = async (
    seasonYear?: number,
  ): Promise<RepositoryResult<ScoreboardsArchive>> => {
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
        if (
          seasonYear !== undefined &&
          relative !== 'schools.json' &&
          !relative.startsWith(`seasons/${String(seasonYear)}/`)
        ) {
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
    const contests = dataset.contests
      .map(({ record }) => record)
      .sort((a, b) => a.id.localeCompare(b.id));
    const seasonStandings = dataset.seasonStandings
      .map(({ record }) => record)
      .sort((a, b) => b.seasonYear - a.seasonYear || a.seriesId.localeCompare(b.seriesId));
    const data: ScoreboardsArchive = {
      source,
      schools: dataset.schools
        .flatMap(({ record }) => record)
        .sort((a, b) => a.id.localeCompare(b.id)),
      teams: dataset.teams.flatMap(({ record }) => record).sort((a, b) => a.id.localeCompare(b.id)),
      contests,
      seasonStandings,
      catalog: catalog ?? {
        contests: contests.map((contest) => contestCatalogEntrySchema.parse(contest)),
        seasonStandings: seasonStandings.map((standing) =>
          seasonStandingCatalogEntrySchema.parse(standing),
        ),
      },
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
  };
  const seasonResults = new Map<number, Promise<RepositoryResult<ScoreboardsArchive>>>();

  return {
    load: () => loadArchive(),
    loadSeason: (seasonYear) => {
      const cached = seasonResults.get(seasonYear);
      if (cached !== undefined) {
        return cached;
      }
      const pending = loadArchive(seasonYear);
      seasonResults.set(seasonYear, pending);
      void pending.then(
        (result) => {
          if (result.status === 'invalid' || result.status === 'error') {
            seasonResults.delete(seasonYear);
          }
        },
        () => {
          seasonResults.delete(seasonYear);
        },
      );
      return pending;
    },
  };
};
