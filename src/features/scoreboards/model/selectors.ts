import { findRecord, type RecordResult } from '@/lib/data/repository';

import { bestKnownPlace, comparePlaces, isPodiumPlace } from './ranking';
import { scoreStandingRow, selectFirstSolves } from './scoring';

import type { Contest, ContestStage, School, SeasonStanding, Team } from './schemas';
import type { ScoreboardsArchive } from '../repositories/scoreboardsRepository';

const stageLabels: Record<ContestStage, string> = {
  'fecha-0': 'Fecha 0',
  'qualifier-1': 'Clasificatoria 1',
  'qualifier-2': 'Clasificatoria 2',
  'qualifier-3': 'Clasificatoria 3',
  repechage: 'Repechaje',
  final: 'Final',
};

export const contestStageLabel = (stage: ContestStage): string => stageLabels[stage];

export const seriesLabel = (id: string): string => {
  if (id === 'gpm') {
    return 'Gran Premio de México';
  }
  if (id === 'mexico-finals') {
    return 'Final Regional Mexicana';
  }
  return id.replaceAll('-', ' ');
};

export const selectCatalog = (archive: ScoreboardsArchive) => {
  const records = [...archive.contests, ...archive.seasonStandings];
  return [...new Set(records.map(({ seasonYear }) => seasonYear))]
    .sort((a, b) => b - a)
    .map((seasonYear) => ({
      seasonYear,
      series: [
        ...new Set(
          records.filter((row) => row.seasonYear === seasonYear).map((row) => row.seriesId),
        ),
      ]
        .sort()
        .map((seriesId) => ({
          id: seriesId,
          label: seriesLabel(seriesId),
          contests: archive.contests
            .filter((contest) => contest.seasonYear === seasonYear && contest.seriesId === seriesId)
            .toSorted(
              (a, b) =>
                (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.id.localeCompare(b.id),
            )
            .map((contest) => ({ ...contest, stageLabel: contestStageLabel(contest.stage) })),
          accumulated: archive.seasonStandings.some(
            (standing) => standing.seasonYear === seasonYear && standing.seriesId === seriesId,
          ),
        })),
    }));
};

export const selectContest = (archive: ScoreboardsArchive, id: string): RecordResult<Contest> =>
  findRecord(archive.contests.find((contest) => contest.id === id));

export const selectSeasonStanding = (
  archive: ScoreboardsArchive,
  seasonYear: number,
  seriesId: string,
): RecordResult<SeasonStanding> =>
  findRecord(
    archive.seasonStandings.find(
      (standing) => standing.seasonYear === seasonYear && standing.seriesId === seriesId,
    ),
  );

export const selectLatestHeldContest = (
  archive: ScoreboardsArchive,
  today: string,
): RecordResult<Contest> =>
  findRecord(
    archive.contests
      .filter((contest) => contest.date !== null && contest.date <= today)
      .toSorted(
        (a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.id.localeCompare(b.id),
      )[0],
  );

const requireRecord = <T>(record: T | undefined, description: string): T => {
  if (record === undefined) {
    throw new Error(`Unresolved ${description}; selectors require a validated archive.`);
  }
  return record;
};

const joinTeam = (
  teamId: string,
  seasonYear: number,
  teamsById: ReadonlyMap<string, Team>,
  schoolsById: ReadonlyMap<string, School>,
) => {
  const team = requireRecord(teamsById.get(teamId), `team ${teamId}`);
  if (team.seasonYear !== seasonYear) {
    throw new Error(
      `Unresolved team ${teamId} in season ${String(seasonYear)}; selectors require a validated archive.`,
    );
  }
  const school =
    team.schoolId === null
      ? null
      : requireRecord(schoolsById.get(team.schoolId), `school ${team.schoolId}`);
  return { team, school };
};

export const selectContestRows = (archive: ScoreboardsArchive, contest: Contest) => {
  const firstSolves = selectFirstSolves(contest);
  const teamsById = new Map(archive.teams.map((team) => [team.id, team]));
  const schoolsById = new Map(archive.schools.map((school) => [school.id, school]));
  return contest.standings
    .map((row) => ({
      ...row,
      ...joinTeam(row.teamId, contest.seasonYear, teamsById, schoolsById),
      ...scoreStandingRow(row, contest.penaltyMinutesPerFailedAttempt),
      firstSolvedLabels: contest.problems
        .filter(({ label }) => firstSolves.get(label)?.has(row.teamId))
        .map(({ label }) => label),
    }))
    .sort((a, b) => comparePlaces(a.place, b.place));
};

export interface StandingsFilters {
  team?: string;
  school?: string;
  problem?: string;
  accepted?: boolean;
  first?: boolean;
}

export const selectFilteredContestRows = (
  archive: ScoreboardsArchive,
  contest: Contest,
  filters: StandingsFilters,
) => {
  if (filters.school !== undefined && !archive.schools.some(({ id }) => id === filters.school)) {
    return { status: 'invalid' as const, field: 'school' as const, value: filters.school };
  }
  const problemIndex = contest.problems.findIndex(({ label }) => label === filters.problem);
  if (filters.problem !== undefined && problemIndex === -1) {
    return { status: 'invalid' as const, field: 'problem' as const, value: filters.problem };
  }
  const rows = selectContestRows(archive, contest);
  return {
    status: 'ready' as const,
    total: rows.length,
    rows: rows.filter((row) => {
      if (
        filters.team &&
        !row.team.name.toLocaleLowerCase('es').includes(filters.team.toLocaleLowerCase('es'))
      ) {
        return false;
      }
      if (filters.school !== undefined && row.school?.id !== filters.school) {
        return false;
      }
      const accepted =
        problemIndex === -1 ? row.solved > 0 : row.results?.[problemIndex]?.status === 'solved';
      return (
        (!filters.accepted || accepted) &&
        (!filters.first ||
          (filters.problem === undefined
            ? row.firstSolvedLabels.length > 0
            : row.firstSolvedLabels.includes(filters.problem)))
      );
    }),
  };
};

export const selectAccumulatedRows = (archive: ScoreboardsArchive, standing: SeasonStanding) => {
  const teamsById = new Map(archive.teams.map((team) => [team.id, team]));
  const schoolsById = new Map(archive.schools.map((school) => [school.id, school]));
  return standing.rows
    .map((row) => ({
      ...row,
      ...joinTeam(row.teamId, standing.seasonYear, teamsById, schoolsById),
    }))
    .sort((a, b) => a.place - b.place);
};

export const selectQualificationCut = (standing: SeasonStanding): number | undefined => {
  if (standing.rows.some((row) => row.qualified === null)) {
    return undefined;
  }
  const rows = standing.rows.toSorted((a, b) => a.place - b.place);
  const firstOut = rows.findIndex((row) => !row.qualified);
  if (firstOut <= 0 || rows.slice(firstOut).some((row) => row.qualified)) {
    return undefined;
  }
  // A shared official place cannot be represented by a single qualification line.
  return rows[firstOut - 1].place === rows[firstOut].place ? undefined : firstOut;
};

export const selectSchoolScope = (
  archive: ScoreboardsArchive,
  schoolId: string,
  scope: 'school' | 'institution',
): RecordResult<{ school: School; schools: School[]; teams: Team[] }> => {
  const school = archive.schools.find(({ id }) => id === schoolId);
  if (!school) {
    return { status: 'not-found' };
  }
  const ids = new Set([schoolId]);
  if (scope === 'institution') {
    let previousSize = 0;
    while (previousSize !== ids.size) {
      previousSize = ids.size;
      archive.schools.forEach((candidate) => {
        if (candidate.parentInstitutionId !== undefined && ids.has(candidate.parentInstitutionId)) {
          ids.add(candidate.id);
        }
      });
    }
  }
  return {
    status: 'found',
    record: {
      school,
      schools: archive.schools.filter(({ id }) => ids.has(id)),
      teams: archive.teams.filter(({ schoolId: id }) => id !== null && ids.has(id)),
    },
  };
};

export const selectSchoolHistory = (
  archive: ScoreboardsArchive,
  schoolId: string,
  scope: 'school' | 'institution' = 'school',
) => {
  const selection = selectSchoolScope(archive, schoolId, scope);
  if (selection.status === 'not-found') {
    return selection;
  }
  const teamIds = new Set(selection.record.teams.map(({ id }) => id));
  const contests = archive.contests
    .flatMap((contest) =>
      selectContestRows(archive, contest)
        .filter(({ teamId }) => teamIds.has(teamId))
        .map((row) => ({ contest, row })),
    )
    .sort(
      (a, b) =>
        a.contest.seasonYear - b.contest.seasonYear ||
        (a.contest.date ?? '').localeCompare(b.contest.date ?? '') ||
        a.contest.id.localeCompare(b.contest.id) ||
        comparePlaces(a.row.place, b.row.place),
    );
  const accumulated = archive.seasonStandings.flatMap((standing) =>
    selectAccumulatedRows(archive, standing)
      .filter(({ teamId }) => teamIds.has(teamId))
      .map((row) => ({ standing, row })),
  );
  const seasons = [
    ...new Set([
      ...contests.map(({ contest }) => contest.seasonYear),
      ...accumulated.map(({ standing }) => standing.seasonYear),
    ]),
  ]
    .sort((a, b) => a - b)
    .map((seasonYear) => {
      const entries = contests.filter(({ contest }) => contest.seasonYear === seasonYear);
      const published = accumulated.filter(({ standing }) => standing.seasonYear === seasonYear);
      return {
        seasonYear,
        teams: new Set([...entries, ...published].map(({ row }) => row.teamId)).size,
        contests: new Set(entries.map(({ contest }) => contest.id)).size,
        bestPlace: bestKnownPlace(entries.map(({ row }) => row.place)),
        podiums:
          entries.filter(({ row }) => isPodiumPlace(row.place)).length +
          published.filter(({ row }) => isPodiumPlace(row.place)).length,
      };
    });
  return {
    status: 'found' as const,
    record: { ...selection.record, scope, contests, accumulated, seasons },
  };
};
