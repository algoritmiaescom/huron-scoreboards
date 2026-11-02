import { Alert, Typography } from '@mui/material';

import { StandingsHeader } from './StandingsHeader';
import { seriesLabel } from '../model/selectors';

import type { SeasonStanding } from '../model/schemas';
import type { DatasetSource } from '@/lib/data/repository';

export const AccumulatedHeader = ({
  standing,
  datasetSource,
}: {
  standing: SeasonStanding;
  datasetSource: DatasetSource;
}) => (
  <StandingsHeader
    hierarchyLabel="Jerarquía de la clasificación acumulada"
    hierarchy={[
      `Temporada ${String(standing.seasonYear)}`,
      seriesLabel(standing.seriesId),
      'Acumulada',
    ]}
    eyebrow={datasetSource === 'mock' ? 'Clasificación de demostración' : 'Archivo de resultados'}
    title={`Clasificación acumulada ${String(standing.seasonYear)}`}
    source={standing.source}
    datasetSource={datasetSource}
  >
    <Typography color="text.secondary">
      {datasetSource === 'mock'
        ? 'Los puntajes y estados de clasificación de esta demostración son inventados.'
        : 'Puntajes y estados de clasificación publicados en la fuente. Huron Scoreboards no calcula estos puntajes.'}
    </Typography>
    {standing.publicationNotes?.map((note) => (
      <Alert severity="warning" key={note}>
        {note}
      </Alert>
    ))}
  </StandingsHeader>
);
