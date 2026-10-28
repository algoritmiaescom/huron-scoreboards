import type { Contest, School, SeasonStanding, Team } from './schemas';
import type { ValidationIssue } from '@/lib/validation/issues';

/** A file's parsed contents, kept with its path so issues can point at the right file. */
export interface DataFile<T> {
  file: string;
  record: T;
}

export interface ContestFile extends DataFile<Contest> {
  /** Season and series derived from the file's location under `data/`. */
  location: { seasonYear: number; seriesId: string };
}

export interface SeasonStandingFile extends DataFile<SeasonStanding> {
  location: { seasonYear: number; seriesId: string };
}

export interface TeamsFile extends DataFile<Team[]> {
  location?: { seasonYear: number };
}

export interface ScoreboardsDataset {
  schools: DataFile<School[]>[];
  teams: TeamsFile[];
  contests: ContestFile[];
  seasonStandings: SeasonStandingFile[];
}

const collectDuplicateIds = <T>(
  files: readonly DataFile<T[]>[],
  getId: (record: T) => string,
  label: string,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const seen = new Map<string, string>();

  files.forEach(({ file, record }) => {
    record.forEach((entry, index) => {
      const id = getId(entry);
      const existing = seen.get(id);

      if (existing === undefined) {
        seen.set(id, file);
        return;
      }

      issues.push({
        file,
        location: `[${String(index)}].id`,
        message: `duplicate ${label} id \`${id}\`, already defined in ${existing}`,
      });
    });
  });

  return issues;
};

const findInstitutionCycle = (schools: readonly School[]): string[] => {
  const parents = new Map(schools.map((school) => [school.id, school.parentInstitutionId]));
  const cyclic: string[] = [];

  schools.forEach((school) => {
    const visited = new Set<string>([school.id]);
    let current = school.parentInstitutionId;

    while (current !== undefined) {
      if (visited.has(current)) {
        cyclic.push(school.id);
        return;
      }

      visited.add(current);
      current = parents.get(current);
    }
  });

  return cyclic;
};

const validateSchools = (dataset: ScoreboardsDataset): ValidationIssue[] => {
  const issues = collectDuplicateIds(dataset.schools, (school) => school.id, 'school');
  const allSchools = dataset.schools.flatMap(({ record }) => record);
  const schoolIds = new Set(allSchools.map((school) => school.id));
  const cyclic = new Set(findInstitutionCycle(allSchools));

  dataset.schools.forEach(({ file, record }) => {
    record.forEach((school, index) => {
      const { parentInstitutionId } = school;

      if (parentInstitutionId === undefined) {
        return;
      }

      if (parentInstitutionId === school.id) {
        issues.push({
          file,
          location: `[${String(index)}].parentInstitutionId`,
          message: `school \`${school.id}\` cannot be its own parent institution`,
        });
        return;
      }

      if (!schoolIds.has(parentInstitutionId)) {
        issues.push({
          file,
          location: `[${String(index)}].parentInstitutionId`,
          message: `unknown school \`${parentInstitutionId}\``,
        });
        return;
      }

      if (cyclic.has(school.id)) {
        issues.push({
          file,
          location: `[${String(index)}].parentInstitutionId`,
          message: `parent institution of \`${school.id}\` forms a cycle`,
        });
      }
    });
  });

  return issues;
};

const validateTeams = (
  dataset: ScoreboardsDataset,
  schoolIds: ReadonlySet<string>,
): ValidationIssue[] => {
  const issues = collectDuplicateIds(dataset.teams, (team) => team.id, 'team');

  dataset.teams.forEach(({ file, record, location }) => {
    record.forEach((team, index) => {
      if (location !== undefined && team.seasonYear !== location.seasonYear) {
        issues.push({
          file,
          location: `[${String(index)}].seasonYear`,
          message: `season ${String(team.seasonYear)} does not match the season ${String(location.seasonYear)} in the file path`,
        });
      }
      if (!schoolIds.has(team.schoolId)) {
        issues.push({
          file,
          location: `[${String(index)}].schoolId`,
          message: `unknown school \`${team.schoolId}\``,
        });
      }
    });
  });

  return issues;
};

const validateTeamReference = (
  file: string,
  location: string,
  teamId: string,
  seasonYear: number,
  teamsById: ReadonlyMap<string, Team>,
): ValidationIssue | undefined => {
  const team = teamsById.get(teamId);

  if (team === undefined) {
    return { file, location, message: `unknown team \`${teamId}\`` };
  }

  if (team.seasonYear !== seasonYear) {
    return {
      file,
      location,
      message: `team \`${teamId}\` is registered for season ${String(team.seasonYear)}, not ${String(seasonYear)}`,
    };
  }

  return undefined;
};

const validateContests = (
  dataset: ScoreboardsDataset,
  teamsById: ReadonlyMap<string, Team>,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const seenIds = new Map<string, string>();

  dataset.contests.forEach(({ file, record, location }) => {
    const existing = seenIds.get(record.id);

    if (existing === undefined) {
      seenIds.set(record.id, file);
    } else {
      issues.push({
        file,
        location: 'id',
        message: `duplicate contest id \`${record.id}\`, already defined in ${existing}`,
      });
    }

    if (record.seasonYear !== location.seasonYear) {
      issues.push({
        file,
        location: 'seasonYear',
        message: `season ${String(record.seasonYear)} does not match the season ${String(location.seasonYear)} in the file path`,
      });
    }

    if (record.seriesId !== location.seriesId) {
      issues.push({
        file,
        location: 'seriesId',
        message: `series \`${record.seriesId}\` does not match the series \`${location.seriesId}\` in the file path`,
      });
    }

    record.standings.forEach((row, index) => {
      const issue = validateTeamReference(
        file,
        `standings[${String(index)}].teamId`,
        row.teamId,
        record.seasonYear,
        teamsById,
      );

      if (issue !== undefined) {
        issues.push(issue);
      }
    });
  });

  return issues;
};

const validateSeasonStandings = (
  dataset: ScoreboardsDataset,
  teamsById: ReadonlyMap<string, Team>,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const seen = new Map<string, string>();

  dataset.seasonStandings.forEach(({ file, record, location }) => {
    const key = `${String(record.seasonYear)}/${record.seriesId}`;
    const existing = seen.get(key);
    if (existing !== undefined) {
      issues.push({
        file,
        location: '',
        message: `duplicate season standing \`${key}\`, already defined in ${existing}`,
      });
    }
    seen.set(key, file);
    if (record.seasonYear !== location.seasonYear) {
      issues.push({
        file,
        location: 'seasonYear',
        message: `season ${String(record.seasonYear)} does not match the season ${String(location.seasonYear)} in the file path`,
      });
    }

    if (record.seriesId !== location.seriesId) {
      issues.push({
        file,
        location: 'seriesId',
        message: `series \`${record.seriesId}\` does not match the series \`${location.seriesId}\` in the file path`,
      });
    }

    record.rows.forEach((row, index) => {
      const issue = validateTeamReference(
        file,
        `rows[${String(index)}].teamId`,
        row.teamId,
        record.seasonYear,
        teamsById,
      );

      if (issue !== undefined) {
        issues.push(issue);
      }
    });
  });

  return issues;
};

/**
 * Checks that span several files, which a single schema cannot express: identifier uniqueness
 * across registries, reference resolution, and agreement between a record and its file location.
 */
export const validateScoreboardsReferences = (dataset: ScoreboardsDataset): ValidationIssue[] => {
  const schoolIds = new Set(dataset.schools.flatMap(({ record }) => record).map(({ id }) => id));
  const teamsById = new Map(
    dataset.teams.flatMap(({ record }) => record).map((team) => [team.id, team]),
  );

  return [
    ...validateSchools(dataset),
    ...validateTeams(dataset, schoolIds),
    ...validateContests(dataset, teamsById),
    ...validateSeasonStandings(dataset, teamsById),
  ];
};
