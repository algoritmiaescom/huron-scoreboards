import RestartAlt from '@mui/icons-material/RestartAlt';
import { Alert, Button, Chip, Divider, Paper, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useSearchParams } from 'react-router';

import { ActiveFilterChips } from './ActiveFilterChips';
import { ContestStandings } from './ContestStandings';
import { ResultsLegend } from './ResultsLegend';
import { ScoreboardFilters } from './ScoreboardFilters';
import { ShareViewAction } from './ShareViewAction';
import { selectFilteredContestRows } from '../model/selectors';
import {
  clearStandingsFilters,
  filterKeys,
  parseStandingsFilters,
  updateStandingsFilter,
} from '../model/standingsFilters';

import type { Contest } from '../model/schemas';
import type { FilterKey } from '../model/standingsFilters';
import type { ScoreboardsArchive } from '../repositories/scoreboardsRepository';

const FilterPanel = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  minWidth: 0,
}));
const Summary = styled('div')(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.spacing(2),
  marginTop: theme.spacing(2),
  '& > *': { minWidth: 0 },
}));

export const ContestResults = ({
  archive,
  contest,
}: {
  archive: ScoreboardsArchive;
  contest: Contest;
}) => {
  const [params, setParams] = useSearchParams();
  const { filters, issues } = parseStandingsFilters(params, archive, contest);
  const result = selectFilteredContestRows(archive, contest, filters);
  const hasFilters = filterKeys.some((key) => params.has(key));
  const update = (key: FilterKey, value: string) => {
    setParams(updateStandingsFilter(params, key, value), { replace: true, flushSync: true });
  };
  const clear = () => {
    setParams(clearStandingsFilters(params), { replace: true, flushSync: true });
  };
  if (result.status !== 'ready') {
    throw new Error('Parsed scoreboard filters must reference the selected archive and contest.');
  }
  return (
    <>
      <FilterPanel variant="outlined">
        <ScoreboardFilters
          filters={filters}
          schools={archive.schools}
          contest={contest}
          onChange={update}
        />
        <Divider />
        <Summary>
          <Typography role="status" variant="body2">
            {issues.length > 0
              ? 'Corrige los filtros para ver los resultados.'
              : `${String(result.rows.length)} de ${String(result.total)} equipos`}
          </Typography>
          {hasFilters && <Chip label="Vista filtrada" color="secondary" size="small" />}
          {hasFilters && (
            <ActiveFilterChips
              params={params}
              archive={archive}
              onRemove={(key) => {
                update(key, '');
              }}
            />
          )}
          {hasFilters && (
            <Button startIcon={<RestartAlt />} onClick={clear}>
              Limpiar todo
            </Button>
          )}
          <ShareViewAction key={params.toString()} />
        </Summary>
      </FilterPanel>
      {issues.length > 0 ? (
        <Alert severity="warning">
          <Stack spacing={1}>
            {issues.map(({ key, message }) => (
              <div key={key}>
                {message}
                <Button
                  onClick={() => {
                    update(key, '');
                  }}
                >
                  Quitar filtro {key}
                </Button>
              </div>
            ))}
          </Stack>
        </Alert>
      ) : (
        <>
          <ResultsLegend />
          {result.rows.length === 0 && result.total > 0 ? (
            <Alert severity="info" action={<Button onClick={clear}>Limpiar filtros</Button>}>
              No hay equipos que coincidan con estos filtros.
            </Alert>
          ) : (
            <ContestStandings contest={contest} rows={result.rows} />
          )}
        </>
      )}
    </>
  );
};
