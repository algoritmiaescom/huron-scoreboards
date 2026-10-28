import { styled } from '@mui/material/styles';

import { formatCalendarDate } from '@/lib/dates';

import { StandingsHeader } from './StandingsHeader';
import { contestStageLabel, seriesLabel } from '../model/selectors';

import type { Contest } from '../model/schemas';
import type { DatasetSource } from '@/lib/data/repository';

const Metadata = styled('ul')(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
  listStyle: 'none',
  padding: 0,
  margin: theme.spacing(2, 0, 0),
  '& li': {
    padding: theme.spacing(0.5, 1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.spacing(8),
    maxWidth: '100%',
  },
}));

export const ContestHeader = ({
  contest,
  datasetSource,
  headingLevel = 'h1',
}: {
  contest: Contest;
  datasetSource: DatasetSource;
  headingLevel?: 'h1' | 'h2';
}) => (
  <StandingsHeader
    hierarchyLabel="Jerarquía del concurso"
    hierarchy={[
      `Temporada ${String(contest.seasonYear)}`,
      seriesLabel(contest.seriesId),
      contestStageLabel(contest.stage),
    ]}
    eyebrow={datasetSource === 'mock' ? 'Concurso de demostración' : 'Archivo de resultados'}
    title={contest.name}
    headingLevel={headingLevel}
    source={contest.source}
    datasetSource={datasetSource}
  >
    <Metadata aria-label="Datos del concurso">
      <li>
        {contest.date === null ? (
          'Fecha desconocida'
        ) : (
          <time dateTime={contest.date}>{formatCalendarDate(contest.date)}</time>
        )}
      </li>
      <li>
        {contest.durationMinutes === null
          ? 'Duración desconocida'
          : `${String(contest.durationMinutes)} min`}
      </li>
      <li>
        {contest.penaltyMinutesPerFailedAttempt === null
          ? 'Regla de penalización desconocida'
          : `Penalización: +${String(contest.penaltyMinutesPerFailedAttempt)} min por intento fallido`}
      </li>
      <li>
        {contest.problems.length === 0
          ? 'Problemas desconocidos'
          : `${String(contest.problems.length)} problemas`}
      </li>
      {contest.stage === 'fecha-0' && <li>No clasificatoria</li>}
    </Metadata>
  </StandingsHeader>
);
