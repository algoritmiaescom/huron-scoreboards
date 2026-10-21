import { selectContest, selectLatestHeldContest, selectSeasonStanding } from './selectors';
import { isFilterKey } from './standingsFilters';

import type { Contest, SeasonStanding } from './schemas';
import type { ScoreboardsArchive } from '../repositories/scoreboardsRepository';

export type ScoreboardSelection =
  | { status: 'selected'; contest: Contest }
  | { status: 'accumulated'; standing: SeasonStanding }
  | { status: 'empty' }
  | { status: 'invalid'; message: string };

export type SelectedScoreboard = Extract<
  ScoreboardSelection,
  { status: 'selected' | 'accumulated' }
>;

export const contestSelectionParams = (id: string): URLSearchParams =>
  new URLSearchParams({ contest: id });

export const accumulatedSelectionParams = (seasonYear: number, seriesId: string): URLSearchParams =>
  new URLSearchParams({ season: String(seasonYear), series: seriesId, view: 'accumulated' });

export const resolveScoreboardSelection = (
  archive: ScoreboardsArchive,
  params: URLSearchParams,
  today: string,
): ScoreboardSelection => {
  const keys = [...params.keys()];
  if (keys.some((key) => !isFilterKey(key) && params.getAll(key).length > 1)) {
    return { status: 'invalid', message: 'La dirección contiene parámetros repetidos.' };
  }
  if (
    keys.some((key) => !['contest', 'season', 'series', 'view'].includes(key) && !isFilterKey(key))
  ) {
    return { status: 'invalid', message: 'La dirección contiene parámetros desconocidos.' };
  }
  if (keys.some((key) => ['season', 'series', 'view'].includes(key))) {
    const season = params.get('season');
    const series = params.get('series');
    if (params.has('contest')) {
      return {
        status: 'invalid',
        message: 'Elige un concurso individual o una clasificación acumulada, no ambos.',
      };
    }
    if (
      params.get('view') !== 'accumulated' ||
      season === null ||
      series === null ||
      series === ''
    ) {
      return {
        status: 'invalid',
        message: 'La clasificación acumulada requiere temporada, serie y view=accumulated.',
      };
    }
    if (!/^\d{4}$/.test(season)) {
      return { status: 'invalid', message: `La temporada "${season}" no es válida.` };
    }
    const standing = selectSeasonStanding(archive, Number(season), series);
    return standing.status === 'found'
      ? { status: 'accumulated', standing: standing.record }
      : {
          status: 'invalid',
          message: `No hay clasificación acumulada publicada para la temporada ${season} y la serie "${series}".`,
        };
  }
  const id = params.get('contest');
  const result = id === null ? selectLatestHeldContest(archive, today) : selectContest(archive, id);
  if (result.status === 'found') {
    return { status: 'selected', contest: result.record };
  }
  return id === null
    ? { status: 'empty' }
    : { status: 'invalid', message: `No existe un concurso con el identificador "${id}".` };
};
