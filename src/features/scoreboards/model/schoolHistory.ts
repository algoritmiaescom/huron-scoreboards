import { bestKnownPlace, isPodiumPlace } from './ranking';
import { selectSchoolHistory } from './selectors';

import type { ScoreboardsArchive } from '../repositories/scoreboardsRepository';

export const selectSchoolHistoryPresentation = (
  archive: ScoreboardsArchive,
  schoolId: string,
  scope: 'school' | 'institution',
) => {
  const selection = selectSchoolHistory(archive, schoolId, scope);
  if (selection.status === 'not-found') {
    return selection;
  }
  const { contests, accumulated } = selection.record;
  const seasonYears = [...new Set(contests.map(({ contest }) => contest.seasonYear))].sort(
    (a, b) => a - b,
  );
  const seasons = seasonYears.map((seasonYear) => {
    const rows = contests.filter(({ contest }) => contest.seasonYear === seasonYear);
    return {
      seasonYear,
      results: rows.length,
      contests: new Set(rows.map(({ contest }) => contest.id)).size,
      teams: new Set(rows.map(({ row }) => row.teamId)).size,
      solved: rows.reduce((total, { row }) => total + row.solved, 0),
      bestPlace: bestKnownPlace(rows.map(({ row }) => row.place)),
      podiums: rows.filter(({ row }) => isPodiumPlace(row.place)),
    };
  });
  return {
    status: 'found' as const,
    record: {
      ...selection.record,
      seasons,
      summary: {
        results: contests.length,
        contests: new Set(contests.map(({ contest }) => contest.id)).size,
        teams: new Set(contests.map(({ row }) => row.teamId)).size,
        podiums: contests.filter(({ row }) => isPodiumPlace(row.place)).length,
        bestPlace: bestKnownPlace(contests.map(({ row }) => row.place)),
      },
      podiums: contests.filter(({ row }) => isPodiumPlace(row.place)),
      accumulated,
    },
  };
};

export type SchoolHistory = Extract<
  ReturnType<typeof selectSchoolHistoryPresentation>,
  { status: 'found' }
>['record'];
