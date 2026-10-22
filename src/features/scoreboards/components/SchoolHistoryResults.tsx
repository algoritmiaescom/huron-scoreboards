import Launch from '@mui/icons-material/Launch';
import { Button, Card, Chip, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { Link } from 'react-router';

import { SchoolIdentity } from './SchoolIdentity';
import { TeamIdentity } from './TeamIdentity';
import { contestStageLabel, seriesLabel } from '../model/selectors';

import type { SchoolHistory } from '../model/schoolHistory';
import type { DatasetSource } from '@/lib/data/repository';

const Results = styled('ol')(({ theme }) => ({
  display: 'grid',
  gap: theme.spacing(2),
  listStyle: 'none',
  margin: 0,
  padding: 0,
}));

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

const ResultData = styled('dl')(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(2),
  margin: 0,
  '& dt': { ...theme.typography.caption, color: theme.palette.text.secondary },
  '& dd': { ...theme.typography.data, margin: 0 },
}));

const ContestLink = styled(Link)(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.palette.primary.main,
  textDecoration: 'underline',
  textUnderlineOffset: '0.15em',
}));

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  );

export const SchoolHistoryResults = ({
  history,
  datasetSource,
}: {
  history: SchoolHistory;
  datasetSource: DatasetSource;
}) => (
  <section aria-labelledby="school-results-heading">
    <Typography id="school-results-heading" component="h2" variant="h4">
      Resultados por concurso
    </Typography>
    {history.contests.length === 0 ? (
      <Typography color="text.secondary">
        Esta escuela todavía no tiene resultados de concursos publicados.
      </Typography>
    ) : (
      <Results aria-label="Resultados de concursos">
        {history.contests.toReversed().map(({ contest, row }) => (
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
                  {contestStageLabel(contest.stage)} · {formatDate(contest.date)}
                </Typography>
                <TeamIdentity team={row.team} />
              </Stack>
              <Stack spacing={1}>
                <SchoolIdentity school={row.school} />
                <Chip
                  size="small"
                  variant="outlined"
                  label={datasetSource === 'mock' ? 'Puesto de demostración' : 'Puesto publicado'}
                />
              </Stack>
              <Stack spacing={1}>
                <ResultData>
                  <div>
                    <dt>Puesto</dt>
                    <dd>#{row.place}</dd>
                  </div>
                  <div>
                    <dt>Resueltos</dt>
                    <dd>{row.solved}</dd>
                  </div>
                  <div>
                    <dt>Penalización</dt>
                    <dd>{row.penalty} min</dd>
                  </div>
                </ResultData>
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
      </Results>
    )}
  </section>
);
