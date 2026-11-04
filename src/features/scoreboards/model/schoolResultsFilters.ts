import { comparePlaces } from './ranking';
import { schoolHistorySeriesOptions } from './schoolHistory';

import type { SchoolHistory } from './schoolHistory';

export const schoolResultsSortOptions = [
  { value: 'newest', label: 'Más recientes' },
  { value: 'place', label: 'Mejor puesto' },
  { value: 'team', label: 'Equipo A–Z' },
  { value: 'solved', label: 'Más problemas resueltos' },
] as const;

export const schoolAccumulatedSortOptions = [
  ...schoolResultsSortOptions.filter(({ value }) => value !== 'solved'),
  { value: 'score', label: 'Mayor puntaje publicado' },
] as const;

export const hasInvalidSchoolHistoryParams = (params: URLSearchParams) =>
  [...params.keys()].some(
    (key) =>
      ![
        'scope',
        'team',
        'season',
        'sort',
        'accumulatedTeam',
        'accumulatedSeason',
        'accumulatedSort',
        'series',
        'tab',
      ].includes(key) || params.getAll(key).length > 1,
  ) ||
  (params.has('series') &&
    !schoolHistorySeriesOptions.some(({ value }) => value === params.get('series'))) ||
  (params.has('tab') &&
    !['seasons', 'accumulated', 'contests'].includes(params.get('tab') ?? '')) ||
  (params.has('scope') && !['school', 'institution'].includes(params.get('scope') ?? '')) ||
  (params.has('season') && !/^\d{4}$/.test(params.get('season') ?? '')) ||
  (params.has('sort') &&
    !schoolResultsSortOptions.some(({ value }) => value === params.get('sort'))) ||
  (params.has('accumulatedSeason') && !/^\d{4}$/.test(params.get('accumulatedSeason') ?? '')) ||
  (params.has('accumulatedSort') &&
    !schoolAccumulatedSortOptions.some(({ value }) => value === params.get('accumulatedSort')));

export const selectSchoolAccumulatedResults = (
  accumulated: SchoolHistory['accumulated'],
  params: URLSearchParams,
) => {
  const team = (params.get('accumulatedTeam') ?? '').trim().toLocaleLowerCase('es');
  const season = params.get('accumulatedSeason');
  const sort = params.get('accumulatedSort') ?? 'newest';
  return accumulated
    .filter(
      ({ standing, row }) =>
        (season === null || String(standing.seasonYear) === season) &&
        row.team.name.toLocaleLowerCase('es').includes(team),
    )
    .sort((a, b) => {
      const newest = b.standing.seasonYear - a.standing.seasonYear;
      if (sort === 'place') return comparePlaces(a.row.place, b.row.place) || newest;
      if (sort === 'team') return a.row.team.name.localeCompare(b.row.team.name, 'es') || newest;
      if (sort === 'score') return b.row.score - a.row.score || newest;
      return newest;
    });
};

export const selectSchoolResults = (
  contests: SchoolHistory['contests'],
  params: URLSearchParams,
) => {
  const team = (params.get('team') ?? '').trim().toLocaleLowerCase('es');
  const season = params.get('season');
  const sort = params.get('sort') ?? 'newest';
  return contests
    .toReversed()
    .filter(
      ({ contest, row }) =>
        (season === null || String(contest.seasonYear) === season) &&
        row.team.name.toLocaleLowerCase('es').includes(team),
    )
    .sort((a, b) => {
      if (sort === 'place') return comparePlaces(a.row.place, b.row.place);
      if (sort === 'team') return a.row.team.name.localeCompare(b.row.team.name, 'es');
      if (sort === 'solved') return b.row.solved - a.row.solved;
      return 0;
    });
};
