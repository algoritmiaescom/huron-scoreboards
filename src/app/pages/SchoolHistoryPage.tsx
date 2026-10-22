import { ArrowBack, Launch } from '@mui/icons-material';
import { Alert, Button, Card, Chip, Container, Paper, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useMemo } from 'react';
import { Link, useLoaderData, useParams, useSearchParams } from 'react-router';

import { SchoolHistoryResults } from '@/features/scoreboards/components/SchoolHistoryResults';
import { SchoolIdentity } from '@/features/scoreboards/components/SchoolIdentity';
import { SchoolParticipationChart } from '@/features/scoreboards/components/SchoolParticipationChart';
import { SchoolTrendChart } from '@/features/scoreboards/components/SchoolTrendChart';
import { TeamIdentity } from '@/features/scoreboards/components/TeamIdentity';
import { selectSchoolHistoryPresentation } from '@/features/scoreboards/model/schoolHistory';

import type { ScoreboardsArchive } from '@/features/scoreboards';
import type { RepositoryResult } from '@/lib/data/repository';

const Page = styled(Container)(({ theme }) => ({
  paddingBlock: theme.spacing(4),
  overflowWrap: 'anywhere',
  [theme.breakpoints.up('md')]: { paddingBlock: theme.spacing(6) },
}));

const Hero = styled(Card)(({ theme }) => ({
  minWidth: 0,
  padding: theme.spacing(2.5),
  borderTop: `4px solid ${theme.palette.brand.yellow}`,
  overflowWrap: 'anywhere',
  [theme.breakpoints.up('md')]: { padding: theme.spacing(4) },
}));

const Statistics = styled('dl')(({ theme }) => ({
  margin: 0,
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: theme.spacing(2),
  [theme.breakpoints.up('md')]: { gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' },
  '& > div': {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(1.5),
    minWidth: 0,
  },
  '& dt': { ...theme.typography.caption, color: theme.palette.text.secondary },
  '& dd': { ...theme.typography.data, fontSize: theme.typography.h6.fontSize, margin: 0 },
}));

const Actions = styled(Stack)(({ theme }) => ({
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: theme.spacing(1),
  [theme.breakpoints.up('sm')]: { flexDirection: 'row', flexWrap: 'wrap' },
}));

const BackLink = styled(Link)(({ theme }) => ({
  ...theme.typography.button,
  alignSelf: 'flex-start',
  color: theme.palette.primary.main,
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
}));
const HighlightLink = styled(Link)(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.palette.primary.main,
  textDecoration: 'underline',
  textUnderlineOffset: '0.15em',
}));
const ScopeChip = styled(Chip)({ alignSelf: 'flex-start' });
const Insights = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: theme.spacing(2),
  alignItems: 'start',
  [theme.breakpoints.up('lg')]: {
    gridTemplateColumns: 'minmax(0, 1.5fr) minmax(18rem, 1fr)',
  },
}));
const SeasonCard = styled(Card)(({ theme }) => ({ padding: theme.spacing(2) }));
const PodiumSection = styled(Card)(({ theme }) => ({ padding: theme.spacing(3) }));
const AccumulatedStack = styled(Stack)(({ theme }) => ({ marginTop: theme.spacing(2) }));
const AccumulatedCard = styled(Card)(({ theme }) => ({ padding: theme.spacing(2) }));
const SummaryRow = styled(Stack)(({ theme }) => ({
  justifyContent: 'space-between',
  [theme.breakpoints.down('sm')]: { flexDirection: 'column', alignItems: 'flex-start' },
  [theme.breakpoints.up('sm')]: { flexDirection: 'row', alignItems: 'center' },
}));
const InlineSummary = styled(Stack)(({ theme }) => ({
  alignItems: 'center',
  flexDirection: 'row',
  gap: theme.spacing(1),
  flexWrap: 'wrap',
}));

const Highlights = styled('ol')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: theme.spacing(1.5),
  listStyle: 'none',
  margin: 0,
  padding: 0,
  [theme.breakpoints.up('md')]: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' },
}));

const Highlight = styled(Paper)(({ theme }) => ({
  minWidth: 0,
  padding: theme.spacing(1.5),
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
  overflowWrap: 'anywhere',
}));

const HistoryPage = styled('div')(({ theme }) => ({
  display: 'grid',
  gap: theme.spacing(4),
}));

export const SchoolHistoryPage = () => {
  const result = useLoaderData<RepositoryResult<ScoreboardsArchive>>();
  const { schoolId = '' } = useParams();
  const [params] = useSearchParams();
  const archive = result.status === 'ready' || result.status === 'empty' ? result.data : undefined;
  const school = archive?.schools.find(({ id }) => id === schoolId);
  const requestedScope = params.get('scope');
  const invalidParams =
    [...params.keys()].some((key) => key !== 'scope') ||
    params.getAll('scope').length > 1 ||
    (requestedScope !== null && requestedScope !== 'school' && requestedScope !== 'institution');
  const scope =
    requestedScope === 'school' || requestedScope === 'institution'
      ? requestedScope
      : school?.parentInstitutionId === undefined
        ? 'institution'
        : 'school';
  const selection = useMemo(
    () =>
      archive === undefined || invalidParams
        ? undefined
        : selectSchoolHistoryPresentation(archive, schoolId, scope),
    [archive, invalidParams, schoolId, scope],
  );

  const clearParams = `/schools/${encodeURIComponent(schoolId)}`;
  if (result.status === 'invalid' || result.status === 'error') {
    return (
      <Page maxWidth="lg">
        <title>Instituciones | Huron Scoreboards</title>
        <Stack spacing={2}>
          <Typography component="h1" variant="h4">
            No pudimos cargar el historial
          </Typography>
          <Alert severity="error">La base de datos publicada tiene un problema.</Alert>
          <ul>
            {result.issues.map((issue) => (
              <li key={`${issue.file}:${issue.location}:${issue.message}`}>
                {issue.file}: {issue.message}
              </li>
            ))}
          </ul>
          <Button
            variant="contained"
            onClick={() => {
              window.location.reload();
            }}
          >
            Reintentar
          </Button>
        </Stack>
      </Page>
    );
  }
  if (invalidParams) {
    return (
      <Page maxWidth="md">
        <title>Selección no disponible | Huron Scoreboards</title>
        <Stack spacing={2}>
          <Typography component="h1" variant="h4">
            Selección no disponible
          </Typography>
          <Alert severity="warning">
            El alcance debe ser único y ser "school" o "institution"; no se admiten otros
            parámetros.
          </Alert>
          <Button component={Link} to={clearParams} variant="contained">
            Restablecer alcance
          </Button>
          <Button component={Link} to="/schools" startIcon={<ArrowBack />}>
            Volver a instituciones
          </Button>
        </Stack>
      </Page>
    );
  }
  if (archive === undefined || school === undefined) {
    return (
      <Page maxWidth="md">
        <title>Institución no encontrada | Huron Scoreboards</title>
        <Stack spacing={2}>
          <Typography component="h1" variant="h4">
            Institución no encontrada
          </Typography>
          <Alert severity="info">
            No existe una institución con el identificador "{schoolId}".
          </Alert>
          <Button component={Link} to="/schools" startIcon={<ArrowBack />} variant="contained">
            Volver a instituciones
          </Button>
        </Stack>
      </Page>
    );
  }
  if (selection?.status !== 'found') {
    throw new Error('School history selection was not resolved from the archive.');
  }

  const history = selection.record;
  const children = archive.schools.filter(
    ({ parentInstitutionId }) => parentInstitutionId === school.id,
  );
  const podiums = history.podiums.toSorted(
    (a, b) => a.row.place - b.row.place || b.contest.date.localeCompare(a.contest.date),
  );
  const highlights = podiums.slice(0, 5);
  return (
    <Page maxWidth="xl">
      <title>{`${school.shortName} | Instituciones | Huron Scoreboards`}</title>
      <HistoryPage>
        <Hero>
          <Stack spacing={2}>
            <BackLink to="/schools">
              <ArrowBack fontSize="small" />
              Todas las instituciones
            </BackLink>
            <SchoolIdentity school={school} heading="h1" />
            <ScopeChip
              label={scope === 'institution' ? 'Alcance institucional' : 'Esta escuela únicamente'}
              variant="outlined"
            />
            <Typography color="text.secondary">
              {scope === 'institution'
                ? children.length > 0
                  ? `Resultados directos de ${school.shortName} y de sus unidades académicas descendientes.`
                  : 'Resultados de equipos registrados con esta institución.'
                : 'Solo resultados de equipos registrados directamente con esta escuela.'}
            </Typography>
            {result.data.source === 'mock' && (
              <Alert severity="warning">
                Datos de demostración: los resultados y estadísticas son inventados.
              </Alert>
            )}
            <Actions>
              {school.parentInstitutionId !== undefined && (
                <Button
                  component={Link}
                  to={`/schools/${school.parentInstitutionId}`}
                  variant="outlined"
                >
                  Ver institución{' '}
                  {archive.schools.find(({ id }) => id === school.parentInstitutionId)?.shortName ??
                    school.parentInstitutionId}
                </Button>
              )}
              {scope === 'institution' && children.length > 0 && (
                <Button component={Link} to={`${clearParams}?scope=school`} variant="outlined">
                  Ver solo resultados directos
                </Button>
              )}
              {scope === 'school' && children.length > 0 && (
                <Button component={Link} to={`${clearParams}?scope=institution`} variant="outlined">
                  Incluir unidades descendientes
                </Button>
              )}
            </Actions>
          </Stack>
        </Hero>

        <section aria-label="Resumen del historial">
          <Statistics>
            <div>
              <dt>Resultados de equipos</dt>
              <dd>{history.summary.results}</dd>
            </div>
            <div>
              <dt>Concursos</dt>
              <dd>{history.summary.contests}</dd>
            </div>
            <div>
              <dt>Equipos</dt>
              <dd>{history.summary.teams}</dd>
            </div>
            <div>
              <dt>Podios</dt>
              <dd>{history.summary.podiums}</dd>
            </div>
            <div>
              <dt>Mejor puesto</dt>
              <dd>
                {history.summary.bestPlace === undefined
                  ? 'Sin resultados'
                  : `#${String(history.summary.bestPlace)}`}
              </dd>
            </div>
          </Statistics>
        </section>

        {history.seasons.length > 0 ? (
          <Insights>
            <SchoolTrendChart seasons={history.seasons} />
            <PodiumSection role="region" aria-labelledby="school-podium-heading">
              <Typography variant="overline" color="primary">
                Podio
              </Typography>
              <Typography id="school-podium-heading" component="h2" variant="h5">
                Mejores puestos
              </Typography>
              <Highlights aria-label="Podios destacados">
                {highlights.length > 0 ? (
                  highlights.map(({ contest, row }) => (
                    <li key={`${contest.id}-${row.teamId}`}>
                      <Highlight variant="outlined">
                        <Typography variant="overline">
                          {contest.seasonYear} · Puesto #{row.place}
                        </Typography>
                        <TeamIdentity team={row.team} />
                        <HighlightLink
                          to={`/scoreboards?contest=${encodeURIComponent(contest.id)}`}
                        >
                          {contest.name}
                        </HighlightLink>
                      </Highlight>
                    </li>
                  ))
                ) : (
                  <li>
                    <Typography color="text.secondary">
                      Aún no hay puestos de podio registrados.
                    </Typography>
                  </li>
                )}
              </Highlights>
            </PodiumSection>
          </Insights>
        ) : (
          <Alert severity="info">
            Todavía no hay resultados de concursos publicados para construir una tendencia.
          </Alert>
        )}

        {history.seasons.length > 0 && <SchoolParticipationChart seasons={history.seasons} />}

        <section aria-labelledby="school-seasons-heading">
          <Typography id="school-seasons-heading" component="h2" variant="h4">
            Temporadas y podios
          </Typography>
          <Typography color="text.secondary">
            Cada participación cuenta una fila de un equipo en un concurso. Si compite en varios,
            cuenta una vez por concurso.
          </Typography>
          {history.seasons.length === 0 ? (
            <Typography color="text.secondary">
              No hay temporadas con concursos publicados.
            </Typography>
          ) : (
            <Stack spacing={2}>
              {history.seasons.map((season) => (
                <SeasonCard key={season.seasonYear} variant="outlined">
                  <Typography component="h3" variant="h5">
                    {season.seasonYear}
                  </Typography>
                  <Typography color="text.secondary">
                    {season.teams} equipos · {season.contests} concursos · {season.results}{' '}
                    participaciones · {season.podiums.length} podios · mejor puesto #
                    {season.bestPlace}
                  </Typography>
                </SeasonCard>
              ))}
            </Stack>
          )}
        </section>

        {history.accumulated.length > 0 && (
          <section aria-labelledby="school-accumulated-heading">
            <Typography id="school-accumulated-heading" component="h2" variant="h4">
              Clasificaciones acumuladas publicadas
            </Typography>
            <Typography color="text.secondary">
              Se muestran por separado y no cuentan como concursos, resultados ni participación.
            </Typography>
            <AccumulatedStack spacing={2}>
              {history.accumulated.map(({ standing, row }) => (
                <AccumulatedCard
                  key={`${String(standing.seasonYear)}-${standing.seriesId}-${row.teamId}`}
                  variant="outlined"
                >
                  <SummaryRow spacing={2}>
                    <div>
                      <Typography component="h3" variant="h6">
                        {standing.seasonYear} · {standing.seriesId} · puesto #{row.place}
                      </Typography>
                      <TeamIdentity team={row.team} />
                    </div>
                    <InlineSummary>
                      <Typography variant="data">Puntaje publicado: {row.score}</Typography>
                      <Chip size="small" label={row.qualified ? 'Clasificado' : 'No clasificado'} />
                      <Button
                        component={Link}
                        to={`/scoreboards?season=${String(standing.seasonYear)}&series=${encodeURIComponent(standing.seriesId)}&view=accumulated`}
                        endIcon={<Launch />}
                      >
                        Ver clasificación
                      </Button>
                    </InlineSummary>
                  </SummaryRow>
                </AccumulatedCard>
              ))}
            </AccumulatedStack>
          </section>
        )}

        <SchoolHistoryResults history={history} datasetSource={result.data.source} />
      </HistoryPage>
    </Page>
  );
};
