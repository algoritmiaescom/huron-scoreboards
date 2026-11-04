import { Button, TextField } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useSearchParams } from 'react-router';

import {
  schoolAccumulatedSortOptions,
  schoolResultsSortOptions,
} from '../model/schoolResultsFilters';

const Controls = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: theme.spacing(2),
  marginBlock: theme.spacing(2),
  '& > *': { minWidth: 0 },
  [theme.breakpoints.up('sm')]: {
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr)) auto',
    alignItems: 'center',
  },
}));

export const SchoolHistoryResultControls = ({
  seasons,
  accumulated = false,
}: {
  seasons: number[];
  accumulated?: boolean;
}) => {
  const [params, setParams] = useSearchParams();
  const keys = accumulated
    ? { team: 'accumulatedTeam', season: 'accumulatedSeason', sort: 'accumulatedSort' }
    : { team: 'team', season: 'season', sort: 'sort' };
  const selectedSeason = params.get(keys.season);
  const options = accumulated ? schoolAccumulatedSortOptions : schoolResultsSortOptions;
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value === '' || (key === keys.sort && value === 'newest')) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true, preventScrollReset: true, flushSync: true });
  };
  const reset = () => {
    const next = new URLSearchParams(params);
    for (const key of Object.values(keys)) next.delete(key);
    setParams(next, { replace: true, preventScrollReset: true, flushSync: true });
  };
  return (
    <Controls
      role="group"
      aria-label={
        accumulated ? 'Filtros de clasificaciones acumuladas' : 'Filtros de resultados de equipos'
      }
    >
      <TextField
        label={accumulated ? 'Nombre del equipo acumulado' : 'Nombre del equipo'}
        size="small"
        value={params.get(keys.team) ?? ''}
        onChange={(event) => {
          update(keys.team, event.target.value);
        }}
      />
      <TextField
        select
        label={accumulated ? 'Temporada acumulada' : 'Temporada'}
        size="small"
        value={selectedSeason ?? ''}
        slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
        onChange={(event) => {
          update(keys.season, event.target.value);
        }}
      >
        <option value="">Todas las temporadas</option>
        {selectedSeason !== null && !seasons.some((year) => String(year) === selectedSeason) && (
          <option value={selectedSeason}>{selectedSeason} (sin resultados)</option>
        )}
        {seasons.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </TextField>
      <TextField
        select
        label={accumulated ? 'Ordenar acumulados por' : 'Ordenar equipos por'}
        size="small"
        value={params.get(keys.sort) ?? 'newest'}
        slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
        onChange={(event) => {
          update(keys.sort, event.target.value);
        }}
      >
        {options.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </TextField>
      <Button onClick={reset}>
        {accumulated ? 'Restablecer acumulados' : 'Restablecer resultados'}
      </Button>
    </Controls>
  );
};
