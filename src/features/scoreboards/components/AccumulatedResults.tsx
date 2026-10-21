import { Alert, Button, Stack } from '@mui/material';
import { useSearchParams } from 'react-router';

import { AccumulatedStandings } from './AccumulatedStandings';
import { ShareViewAction } from './ShareViewAction';
import { clearStandingsFilters, filterKeys } from '../model/standingsFilters';

import type { SeasonStanding } from '../model/schemas';
import type { ScoreboardsArchive } from '../repositories/scoreboardsRepository';

export const AccumulatedResults = ({
  archive,
  standing,
}: {
  archive: ScoreboardsArchive;
  standing: SeasonStanding;
}) => {
  const [params, setParams] = useSearchParams();
  if (filterKeys.some((key) => params.has(key))) {
    return (
      <Alert severity="warning">
        <Stack spacing={2}>
          Los filtros de concurso no están disponibles en la clasificación acumulada.
          <Button
            onClick={() => {
              setParams(clearStandingsFilters(params), { replace: true, flushSync: true });
            }}
          >
            Quitar filtros de concurso
          </Button>
        </Stack>
      </Alert>
    );
  }
  return (
    <>
      <ShareViewAction key={params.toString()} />
      <AccumulatedStandings archive={archive} standing={standing} />
    </>
  );
};
