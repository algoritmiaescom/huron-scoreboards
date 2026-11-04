import Launch from '@mui/icons-material/Launch';
import { Button, Card, Chip, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { Link, useSearchParams } from 'react-router';

import { DataList, ListGrid, TextLink } from '@/components';
import { formatCalendarDate } from '@/lib/dates';

import { SchoolHistoryResultControls } from './SchoolHistoryResultControls';
import { SchoolIdentity } from './SchoolIdentity';
import { TeamIdentity } from './TeamIdentity';
import { formatPlace } from '../model/ranking';
import { selectSchoolResults } from '../model/schoolResultsFilters';
import { contestStageLabel, seriesLabel } from '../model/selectors';

import type { SchoolHistory } from '../model/schoolHistory';
import type { DatasetSource } from '@/lib/data/repository';

const Result = styled(Card)(({ theme }) => ({
  padding: theme.spacing(2),
  display: 'grid',
  gap: theme.spacing(2),
  gridTemplateColumns: 'minmax(0, 1fr)',
  overflowWrap: 'anywhere',
  [theme.breakpoints.up('md')]: {
    alignItems: 'center',
    gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) auto',
  },
}));

const ContestLink = styled(TextLink)(({ theme }) => theme.typography.body1);

export const SchoolHistoryResults = ({
  history,
  datasetSource,
}: {
  history: SchoolHistory;
  datasetSource: DatasetSource;
}) => {
  const [params] = useSearchParams();
  const seasons = [...new Set(history.contests.map(({ contest }) => contest.seasonYear))].sort(
    (a, b) => b - a,
  );
  const results = selectSchoolResults(history.contests, params);
  return (
    <section aria-labelledby="school-results-heading">
      <Typography id="school-results-heading" component="h2" variant="h4">
        Resultados por concurso
      </Typography>
      {history.contests.length === 0 ? (
        <Typography color="text.secondary">
          Esta escuela todavía no tiene resultados de concursos publicados.
        </Typography>
      ) : (
        <>
          <SchoolHistoryResultControls seasons={seasons} />
          <Typography role="status" aria-label="Recuento de concursos" color="text.secondary">
            {results.length} de {history.contests.length} resultados de equipos
          </Typography>
          {results.length === 0 ? (
            <Typography color="text.secondary">
              No hay resultados que coincidan con estos filtros.
            </Typography>
          ) : (
            <ListGrid aria-label="Resultados de concursos">
              {results.map(({ contest, row }) => (
                <li key={`${contest.id}-${row.teamId}`}>
                  <Result>
                    <Stack spacing={1}>
                      <Typography component="h3" variant="h6">
                        <ContestLink to={`/scoreboards?contest=${encodeURIComponent(contest.id)}`}>
                          {contest.name}
                        </ContestLink>
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {contest.seasonYear} · {seriesLabel(contest.seriesId)} ·{' '}
                        {contestStageLabel(contest.stage)} ·{' '}
                        {formatCalendarDate(contest.date, 'medium')}
                      </Typography>
                      <TeamIdentity team={row.team} />
                    </Stack>
                    <Stack spacing={1}>
                      <SchoolIdentity school={row.school} />
                      <Chip
                        size="small"
                        variant="outlined"
                        label={
                          datasetSource === 'mock' ? 'Puesto de demostración' : 'Puesto publicado'
                        }
                      />
                    </Stack>
                    <Stack spacing={1}>
                      <DataList
                        items={[
                          { label: 'Puesto', value: formatPlace(row.place) },
                          { label: 'Resueltos', value: row.solved },
                          {
                            label: 'Penalización',
                            value:
                              row.penalty === null ? 'Desconocida' : `${String(row.penalty)} min`,
                          },
                        ]}
                      />
                      <Button
                        component={Link}
                        to={`/scoreboards?contest=${encodeURIComponent(contest.id)}`}
                        endIcon={<Launch />}
                        size="small"
                      >
                        Ver concurso completo
                      </Button>
                    </Stack>
                  </Result>
                </li>
              ))}
            </ListGrid>
          )}
        </>
      )}
    </section>
  );
};
