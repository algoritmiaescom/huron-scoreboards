import { bestKnownPlace, isPodiumPlace } from './ranking';
import { selectSchoolHistory, seriesLabel } from './selectors';

import type { ScoreboardsArchive } from '../repositories/scoreboardsRepository';

export const schoolHistorySeriesOptions = [
  { value: 'all', label: 'Todas las series' },
  { value: 'gpm-qualifiers', label: `${seriesLabel('gpm')} · Clasificatorias` },
  { value: 'gpm-accumulated', label: `${seriesLabel('gpm')} · Clasificación acumulada` },
  { value: 'mexico-finals', label: seriesLabel('mexico-finals') },
] as const;

export type SchoolHistorySeries = (typeof schoolHistorySeriesOptions)[number]['value'];

export const selectSchoolHistoryPresentation = (
  archive: ScoreboardsArchive,
  schoolId: string,
  scope: 'school' | 'institution',
  series: SchoolHistorySeries = 'all',
) => {
  const filteredArchive = {
    ...archive,
    contests: archive.contests.filter(
      (contest) =>
        series === 'all' ||
        (series === 'gpm-qualifiers' && contest.seriesId === 'gpm') ||
        (series === 'mexico-finals' && contest.seriesId === 'mexico-finals'),
    ),
    seasonStandings: archive.seasonStandings.filter(
      (standing) =>
        series === 'all' || (series === 'gpm-accumulated' && standing.seriesId === 'gpm'),
    ),
  };
  const selection = selectSchoolHistory(filteredArchive, schoolId, scope);
  if (selection.status === 'not-found') {
    return selection;
  }
  const { contests, accumulated } = selection.record;
  const podiums = [
    ...contests
      .filter(({ row }) => isPodiumPlace(row.place))
      .map(({ contest, row }) => ({
        key: `${contest.id}-${row.teamId}`,
        seasonYear: contest.seasonYear,
        date: contest.date,
        name: contest.name,
        href: `/scoreboards?contest=${encodeURIComponent(contest.id)}`,
        row,
        notice: undefined,
      })),
    ...accumulated
      .filter(({ row }) => isPodiumPlace(row.place))
      .map(({ standing, row }) => ({
        key: `${String(standing.seasonYear)}-${standing.seriesId}-${row.teamId}`,
        seasonYear: standing.seasonYear,
        date: null,
        name: `${standing.seriesId.toUpperCase()} ${String(standing.seasonYear)} · Clasificación acumulada`,
        href: `/scoreboards?season=${String(standing.seasonYear)}&series=${encodeURIComponent(standing.seriesId)}&view=accumulated`,
        row,
        notice:
          standing.snapshot === 'intermediate'
            ? `${standing.snapshotLabel ?? 'Clasificación intermedia'} (resultado intermedio)`
            : standing.snapshot === 'unconfirmed'
              ? `${standing.snapshotLabel ?? 'Clasificación publicada'} (no confirmado como final)`
              : undefined,
      })),
  ];
  const seasonYears = selection.record.seasons.map(({ seasonYear }) => seasonYear);
  const seasons = seasonYears.map((seasonYear) => {
    const rows = contests.filter(({ contest }) => contest.seasonYear === seasonYear);
    const published = accumulated.filter(({ standing }) => standing.seasonYear === seasonYear);
    return {
      seasonYear,
      results: rows.length,
      contests: new Set(rows.map(({ contest }) => contest.id)).size,
      teams: new Set(rows.map(({ row }) => row.teamId)).size,
      solved: rows.reduce((total, { row }) => total + row.solved, 0),
      bestPlace: bestKnownPlace([...rows, ...published].map(({ row }) => row.place)),
      podiums: podiums.filter((podium) => podium.seasonYear === seasonYear),
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
        podiums: podiums.length,
        bestPlace: bestKnownPlace([...contests, ...accumulated].map(({ row }) => row.place)),
      },
      podiums,
      accumulated,
    },
  };
};

export type SchoolHistory = Extract<
  ReturnType<typeof selectSchoolHistoryPresentation>,
  { status: 'found' }
>['record'];
