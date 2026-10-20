import { selectContest, selectLatestHeldContest } from './selectors';

import type { Contest } from './schemas';
import type { ScoreboardsArchive } from '../repositories/scoreboardsRepository';

export type ContestSelection =
  | { status: 'selected'; contest: Contest }
  | { status: 'empty' }
  | { status: 'invalid' | 'unavailable'; message: string };

export const resolveContestSelection = (
  archive: ScoreboardsArchive,
  params: URLSearchParams,
  today: string,
): ContestSelection => {
  const keys = [...params.keys()];
  if (keys.some((key) => params.getAll(key).length > 1)) {
    return { status: 'invalid', message: 'La dirección contiene parámetros repetidos.' };
  }
  if (keys.some((key) => ['season', 'series', 'view'].includes(key))) {
    return {
      status: 'unavailable',
      message: 'La vista acumulada aún no está disponible. Elige un concurso individual.',
    };
  }
  if (keys.some((key) => ['team', 'school', 'problem', 'accepted', 'first'].includes(key))) {
    return {
      status: 'unavailable',
      message:
        'Los filtros aún no están disponibles. Quita los parámetros para ver el concurso completo.',
    };
  }
  if (keys.some((key) => key !== 'contest')) {
    return { status: 'invalid', message: 'La dirección contiene parámetros desconocidos.' };
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
