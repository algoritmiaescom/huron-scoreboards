import { ArrowBack, LocationOnOutlined } from '@mui/icons-material';
import {
  Alert,
  Button,
  Card,
  Chip,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { useMemo, useState } from 'react';
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
import { SchoolAccumulatedResults } from '@/features/scoreboards/components/SchoolAccumulatedResults';
import { SchoolHistoryResults } from '@/features/scoreboards/components/SchoolHistoryResults';
import { SchoolLogo } from '@/features/scoreboards/components/SchoolLogo';
import { SchoolParticipationChart } from '@/features/scoreboards/components/SchoolParticipationChart';
import { SchoolTrendChart } from '@/features/scoreboards/components/SchoolTrendChart';
import { TeamIdentity } from '@/features/scoreboards/components/TeamIdentity';
import { comparePlaces, formatPlace } from '@/features/scoreboards/model/ranking';
import {
  schoolHistorySeriesOptions,
  selectSchoolHistoryPresentation,
} from '@/features/scoreboards/model/schoolHistory';
import { hasInvalidSchoolHistoryParams } from '@/features/scoreboards/model/schoolResultsFilters';

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
  '& > *': { minWidth: 0 },
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
  const [params, setParams] = useSearchParams();
  const [expandedPodiumScope, setExpandedPodiumScope] = useState<string>();
  const archive = result.status === 'ready' || result.status === 'empty' ? result.data : undefined;
  const school = archive?.schools.find(({ id }) => id === schoolId);
  const requestedScope = params.get('scope');
  const invalidParams = hasInvalidSchoolHistoryParams(params);
  const selectedSeries =
    schoolHistorySeriesOptions.find(({ value }) => value === params.get('series'))?.value ?? 'all';
  const activeTab = params.get('tab') ?? 'seasons';
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
        : selectSchoolHistoryPresentation(archive, schoolId, scope, selectedSeries),
    [archive, invalidParams, schoolId, scope, selectedSeries],
  );
  const updateView = (key: 'series' | 'tab', value: string) => {
    const next = new URLSearchParams(params);
    if ((key === 'series' && value === 'all') || (key === 'tab' && value === 'seasons'))
      next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true, preventScrollReset: true, flushSync: true });
  };

  const clearParams = `/schools/${encodeURIComponent(schoolId)}`;
  const scopeUrl = (value: 'school' | 'institution') => {
    const next = new URLSearchParams(params);
    next.set('scope', value);
    return `${clearParams}?${next.toString()}`;
  };
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
          El alcance debe ser único y ser "school" o "institution". Los filtros de equipo, temporada
          y orden de concursos y acumulados, la serie y la pestaña deben ser válidos y únicos; no se
          admiten otros parámetros.
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
  const podiumScope = `${schoolId}:${scope}:${selectedSeries}`;
  const allPodiumsVisible = expandedPodiumScope === podiumScope;
  const highlights = allPodiumsVisible ? podiums : podiums.slice(0, 5);
  const contestSeasons = history.seasons.filter(({ results }) => results > 0);
  return (
    <>
      <DocumentTitle
        description={`Consulta el historial de resultados, temporadas y participación de ${school.officialName} en el ICPC México.`}
      >{`${school.shortName} | Instituciones`}</DocumentTitle>
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
            <TextField
              select
              label="Serie del historial"
              size="small"
              value={selectedSeries}
              slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
              onChange={(event) => {
                updateView('series', event.target.value);
              }}
            >
              {schoolHistorySeriesOptions.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </TextField>
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
                <Button component={Link} to={scopeUrl('school')} variant="outlined">
                  Ver solo resultados directos
                </Button>
              )}
              {scope === 'school' && children.length > 0 && (
                <Button component={Link} to={scopeUrl('institution')} variant="outlined">
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
            {history.seasons.length > 0 ? (
              <SchoolTrendChart seasons={history.seasons} />
            ) : (
              <Alert severity="info">
                Todavía no hay resultados publicados para construir una tendencia.
              </Alert>
            )}
            <PodiumSection role="region" aria-labelledby="school-podium-heading">
              <SectionTitle id="school-podium-heading" eyebrow="Podio" title="Mejores puestos" />
              <ListGrid
                id="school-podium-list"
                columns={{ md: 3 }}
                spacing={1.5}
                aria-label="Podios destacados"
              >
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
              {podiums.length > 5 && (
                <Button
                  aria-expanded={allPodiumsVisible}
                  aria-controls="school-podium-list"
                  onClick={() => {
                    setExpandedPodiumScope(allPodiumsVisible ? undefined : podiumScope);
                  }}
                >
                  {allPodiumsVisible ? 'Ver menos' : 'Ver todos'}
                </Button>
              )}
            </PodiumSection>
          </Insights>

          {contestSeasons.length > 0 && <SchoolParticipationChart seasons={contestSeasons} />}

          <div>
            <Tabs
              value={activeTab}
              onChange={(_, value: string) => {
                updateView('tab', value);
              }}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              aria-label="Secciones del historial"
            >
              <Tab
                id="school-tab-seasons"
                value="seasons"
                label="Temporadas y podios"
                aria-controls="school-panel-seasons"
              />
              <Tab
                id="school-tab-accumulated"
                value="accumulated"
                label="Clasificaciones acumuladas"
                aria-controls="school-panel-accumulated"
              />
              <Tab
                id="school-tab-contests"
                value="contests"
                label="Resultados por concursos"
                aria-controls="school-panel-contests"
              />
            </Tabs>
            <div
              role="tabpanel"
              id="school-panel-seasons"
              aria-labelledby="school-tab-seasons"
              hidden={activeTab !== 'seasons'}
            >
              {activeTab === 'seasons' && (
                <section aria-labelledby="school-seasons-heading">
                  <Typography id="school-seasons-heading" component="h2" variant="h4">
                    Temporadas y podios
                  </Typography>
                  <Typography color="text.secondary">
                    Cada participación cuenta una fila de un equipo en un concurso. Si compite en
                    varios, cuenta una vez por concurso. Los podios y el mejor puesto también
                    incluyen clasificaciones acumuladas; las estadísticas de participación solo
                    consideran concursos.
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
              )}
            </div>

            <div
              role="tabpanel"
              id="school-panel-accumulated"
              aria-labelledby="school-tab-accumulated"
              hidden={activeTab !== 'accumulated'}
            >
              {activeTab === 'accumulated' && <SchoolAccumulatedResults history={history} />}
            </div>

            <div
              role="tabpanel"
              id="school-panel-contests"
              aria-labelledby="school-tab-contests"
              hidden={activeTab !== 'contests'}
            >
              {activeTab === 'contests' && (
                <SchoolHistoryResults history={history} datasetSource={result.data.source} />
              )}
            </div>
          </div>
        </HistoryPage>
      </Content>
    </>
  );
};
