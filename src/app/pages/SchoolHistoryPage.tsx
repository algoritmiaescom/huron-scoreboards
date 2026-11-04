import { ArrowBack, Launch, LocationOnOutlined } from '@mui/icons-material';
import { Alert, Button, Card, Chip, Paper, Stack, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { useMemo } from 'react';
import { Link, useLoaderData, useParams, useSearchParams } from 'react-router';

import { DocumentTitle } from '@/app/components/DocumentTitle';
import {
  DataList,
  DataLoadError,
  HeroBanner,
  ListGrid,
  PageContainer,
  SectionTitle,
  TextLink,
} from '@/components';
import { QualificationChip } from '@/features/scoreboards/components/QualificationChip';
import { SchoolHistoryResults } from '@/features/scoreboards/components/SchoolHistoryResults';
import { SchoolLogo } from '@/features/scoreboards/components/SchoolLogo';
import { SchoolParticipationChart } from '@/features/scoreboards/components/SchoolParticipationChart';
import { SchoolTrendChart } from '@/features/scoreboards/components/SchoolTrendChart';
import { TeamIdentity } from '@/features/scoreboards/components/TeamIdentity';
import { comparePlaces, formatPlace } from '@/features/scoreboards/model/ranking';
import { selectSchoolHistoryPresentation } from '@/features/scoreboards/model/schoolHistory';

import type { ScoreboardsArchive } from '@/features/scoreboards';
import type { RepositoryResult } from '@/lib/data/repository';
import type { Theme } from '@mui/material/styles';
import type { ReactNode } from 'react';

const Hero = styled(HeroBanner)(({ theme }) => ({
  paddingBlock: theme.spacing(5),
  [theme.breakpoints.up('md')]: { paddingBlock: theme.spacing(8) },
  '& [data-hero-title]': {
    marginTop: 0,
    fontSize: '2.6rem',
    [theme.breakpoints.up('md')]: { fontSize: '4.5rem' },
  },
}));

const onBanner = (theme: Theme) => theme.palette.getContrastText(theme.palette.brand.navy);

const BackButton = styled(Button)(({ theme }) => ({
  color: onBanner(theme),
  opacity: 0.75,
})) as typeof Button;

const NameChip = styled(Chip)(({ theme }) => ({
  color: onBanner(theme),
  borderColor: onBanner(theme),
  opacity: 0.75,
}));

const LogoTile = styled('span')(({ theme }) => ({
  display: 'grid',
  placeItems: 'center',
  padding: theme.spacing(0.5),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.common.white,
  color: theme.palette.brand.navy,
}));

const Location = styled(Typography)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginTop: theme.spacing(2),
  color: onBanner(theme),
  opacity: 0.7,
}));

const BestPlace = styled(DataList)(({ theme }) => ({
  flexShrink: 0,
  '& dt': {
    ...theme.typography.overline,
    color: alpha(onBanner(theme), 0.6),
  },
  '& dd': {
    fontSize: '4rem',
    fontWeight: 700,
    lineHeight: 1.2,
    color: theme.palette.brand.yellow,
  },
}));

const Content = styled(PageContainer)(({ theme }) => ({
  paddingBlock: theme.spacing(4),
  [theme.breakpoints.up('md')]: { paddingBlock: theme.spacing(4) },
}));

const Statistics = styled(DataList)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: theme.spacing(2),
  [theme.breakpoints.up('lg')]: { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' },
  '& > div': {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(1.5),
    minWidth: 0,
  },
  '& dd': { fontSize: theme.typography.h6.fontSize },
}));

const Actions = styled(Stack)(({ theme }) => ({
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: theme.spacing(1),
  [theme.breakpoints.up('sm')]: { flexDirection: 'row', flexWrap: 'wrap' },
}));

const HighlightLink = styled(TextLink)(({ theme }) => theme.typography.body1);
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

const StatusSection = ({
  documentTitle,
  maxWidth = 'md',
  children,
}: {
  documentTitle: string;
  maxWidth?: 'md' | 'lg';
  children: ReactNode;
}) => (
  <PageContainer maxWidth={maxWidth}>
    <DocumentTitle>{documentTitle}</DocumentTitle>
    <Stack spacing={2}>{children}</Stack>
  </PageContainer>
);

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
      <StatusSection documentTitle="Instituciones" maxWidth="lg">
        <DataLoadError
          title="No pudimos cargar el historial"
          headingLevel="h1"
          message="La base de datos publicada tiene un problema."
          issues={result.issues}
        />
      </StatusSection>
    );
  }
  if (invalidParams) {
    return (
      <StatusSection documentTitle="Selección no disponible">
        <Typography component="h1" variant="h4">
          Selección no disponible
        </Typography>
        <Alert severity="warning">
          El alcance debe ser único y ser "school" o "institution"; no se admiten otros parámetros.
        </Alert>
        <Button component={Link} to={clearParams} variant="contained">
          Restablecer alcance
        </Button>
        <Button component={Link} to="/schools" startIcon={<ArrowBack />}>
          Volver a instituciones
        </Button>
      </StatusSection>
    );
  }
  if (archive === undefined || school === undefined) {
    return (
      <StatusSection documentTitle="Institución no encontrada">
        <Typography component="h1" variant="h4">
          Institución no encontrada
        </Typography>
        <Alert severity="info">No existe una institución con el identificador "{schoolId}".</Alert>
        <Button component={Link} to="/schools" startIcon={<ArrowBack />} variant="contained">
          Volver a instituciones
        </Button>
      </StatusSection>
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
    (a, b) =>
      comparePlaces(a.row.place, b.row.place) ||
      b.seasonYear - a.seasonYear ||
      (b.date ?? '').localeCompare(a.date ?? '') ||
      a.key.localeCompare(b.key),
  );
  const highlights = podiums.slice(0, 5);
  const contestSeasons = history.seasons.filter(({ results }) => results > 0);
  return (
    <>
      <DocumentTitle>{`${school.shortName} | Instituciones`}</DocumentTitle>
      <Hero
        asideBreakpoint="md"
        navigation={
          <BackButton component={Link} to="/schools" startIcon={<ArrowBack />}>
            Todas las instituciones
          </BackButton>
        }
        badges={
          <>
            {school.logo !== undefined && (
              <LogoTile>
                <SchoolLogo school={school} />
              </LogoTile>
            )}
            <Chip
              label={scope === 'institution' ? 'Alcance institucional' : 'Esta escuela únicamente'}
              color="secondary"
            />
            <NameChip label={school.shortName} variant="outlined" />
          </>
        }
        title={school.officialName}
        aside={
          <BestPlace
            items={[
              {
                label: 'Mejor puesto',
                value:
                  history.summary.bestPlace === undefined
                    ? '—'
                    : `#${String(history.summary.bestPlace)}`,
              },
            ]}
          />
        }
      >
        {(school.city !== undefined || school.state !== undefined) && (
          <Location>
            <LocationOnOutlined aria-hidden="true" />
            {[school.city, school.state].filter((part) => part !== undefined).join(', ')}
          </Location>
        )}
      </Hero>
      <Content maxWidth="xl">
        <HistoryPage>
          <Stack spacing={2}>
            <Alert severity={scope === 'institution' ? 'info' : 'warning'}>
              {scope === 'institution'
                ? children.length > 0
                  ? `Resultados directos de ${school.shortName} y de sus unidades académicas descendientes.`
                  : 'Resultados de equipos registrados con esta institución.'
                : 'Solo resultados de equipos registrados directamente con esta escuela.'}
            </Alert>
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

          <section aria-label="Resumen del historial">
            <Statistics
              items={[
                { label: 'Resultados de equipos', value: history.summary.results },
                { label: 'Concursos', value: history.summary.contests },
                { label: 'Equipos', value: history.summary.teams },
                { label: 'Podios', value: history.summary.podiums },
              ]}
            />
          </section>

          <Insights>
            {contestSeasons.length > 0 ? (
              <SchoolTrendChart seasons={contestSeasons} />
            ) : (
              <Alert severity="info">
                Todavía no hay resultados de concursos publicados para construir una tendencia.
              </Alert>
            )}
            <PodiumSection role="region" aria-labelledby="school-podium-heading">
              <SectionTitle id="school-podium-heading" eyebrow="Podio" title="Mejores puestos" />
              <ListGrid columns={{ md: 3 }} spacing={1.5} aria-label="Podios destacados">
                {highlights.length > 0 ? (
                  highlights.map(({ key, seasonYear, name, href, row, notice }) => (
                    <li key={key}>
                      <Highlight variant="outlined">
                        <Typography variant="overline">
                          {seasonYear} · Puesto #{row.place}
                        </Typography>
                        <TeamIdentity team={row.team} />
                        <HighlightLink to={href}>{name}</HighlightLink>
                        {notice !== undefined && <Alert severity="warning">{notice}</Alert>}
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
              </ListGrid>
            </PodiumSection>
          </Insights>

          {contestSeasons.length > 0 && <SchoolParticipationChart seasons={contestSeasons} />}

          <section aria-labelledby="school-seasons-heading">
            <Typography id="school-seasons-heading" component="h2" variant="h4">
              Temporadas y podios
            </Typography>
            <Typography color="text.secondary">
              Cada participación cuenta una fila de un equipo en un concurso. Si compite en varios,
              cuenta una vez por concurso. Los podios también incluyen clasificaciones acumuladas;
              el mejor puesto y las demás estadísticas solo consideran concursos.
            </Typography>
            {history.seasons.length === 0 ? (
              <Typography color="text.secondary">
                No hay temporadas con resultados publicados.
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
                      participaciones · {season.podiums.length} podios · mejor puesto{' '}
                      {formatPlace(season.bestPlace)}
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
                        <QualificationChip qualified={row.qualified} />
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
      </Content>
    </>
  );
};
