import Search from '@mui/icons-material/Search';
import {
  Alert,
  Button,
  Container,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useMemo } from 'react';
import { useLoaderData, useSearchParams } from 'react-router';

import { SchoolSummaryCard } from '@/features/scoreboards/components/SchoolSummaryCard';
import {
  filterSchoolDirectory,
  selectSchoolDirectory,
} from '@/features/scoreboards/model/schoolDirectory';

import type { ScoreboardsArchive } from '@/features/scoreboards';
import type { RepositoryResult } from '@/lib/data/repository';

const Page = styled(Container)(({ theme }) => ({
  paddingBlock: theme.spacing(6),
  overflowWrap: 'anywhere',
  [theme.breakpoints.up('md')]: { paddingBlock: theme.spacing(10) },
}));

const Hero = styled('header')(({ theme }) => ({
  position: 'relative',
  maxWidth: 1140,
  [theme.breakpoints.up('lg')]: {
    paddingRight: theme.spacing(22),
    '&::after': {
      content: '""',
      position: 'absolute',
      width: theme.spacing(15),
      height: theme.spacing(15),
      border: `${theme.spacing(2)} solid ${theme.palette.brand.yellow}`,
      borderRadius: '50%',
      right: 0,
      top: theme.spacing(1),
      opacity: 0.75,
      pointerEvents: 'none',
    },
  },
}));

const Heading = styled(Typography)(({ theme }) => ({
  fontSize: '3.1rem',
  marginBlock: theme.spacing(1, 3),
  [theme.breakpoints.up('md')]: { fontSize: '6rem' },
}));

const SearchPanel = styled('div')(({ theme }) => ({
  maxWidth: 680,
  padding: theme.spacing(1),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[3],
}));

const Grid = styled('ul')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: theme.spacing(3),
  padding: 0,
  margin: 0,
  listStyle: 'none',
  '& > li': { minWidth: 0 },
  [theme.breakpoints.up('sm')]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
  [theme.breakpoints.up('lg')]: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' },
}));

export const SchoolsPage = () => {
  const result = useLoaderData<RepositoryResult<ScoreboardsArchive>>();
  const [params, setParams] = useSearchParams();
  const summaries = useMemo(
    () =>
      result.status === 'ready' || result.status === 'empty'
        ? selectSchoolDirectory(result.data)
        : [],
    [result],
  );
  const query = params.get('q') ?? '';
  const filtered = filterSchoolDirectory(summaries, query);
  const invalidQuery =
    params.getAll('q').length > 1 || [...params.keys()].some((key) => key !== 'q');
  const clearSearch = () => {
    setParams({}, { replace: true, flushSync: true });
  };
  return (
    <Page maxWidth="xl">
      <title>Instituciones | Huron Scoreboards</title>
      <Stack spacing={6}>
        <Hero>
          <Typography variant="overline" color="primary">
            02 — Instituciones participantes
          </Typography>
          <Heading variant="h1">Instituciones a través de cada temporada.</Heading>
          <Typography color="text.secondary">
            Los equipos se registran para una temporada. Los perfiles de las instituciones son el
            hilo estable para entender el rendimiento a largo plazo.
          </Typography>
        </Hero>
        {result.status === 'invalid' || result.status === 'error' ? (
          <Stack spacing={2}>
            <Alert severity="error">
              No pudimos cargar las instituciones. La base de datos publicada tiene un problema.
            </Alert>
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
        ) : summaries.length === 0 ? (
          <Alert severity="info">Todavía no hay instituciones publicadas en este archivo.</Alert>
        ) : (
          <>
            {result.data.source === 'mock' && (
              <Alert severity="warning">
                Datos de demostración: las estadísticas provienen de resultados inventados.
              </Alert>
            )}
            <SearchPanel>
              <TextField
                fullWidth
                label="Buscar instituciones, unidades, ciudades o estados"
                value={query}
                onChange={(event) => {
                  const next = new URLSearchParams(params);
                  if (event.target.value === '') {
                    next.delete('q');
                  } else {
                    next.set('q', event.target.value);
                  }
                  setParams(next, { replace: true, flushSync: true });
                }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </SearchPanel>
            {invalidQuery ? (
              <Stack spacing={2}>
                <Alert severity="warning">
                  La búsqueda contiene parámetros repetidos o desconocidos.
                </Alert>
                <Button onClick={clearSearch}>Restablecer búsqueda</Button>
              </Stack>
            ) : (
              <>
                <Typography role="status" variant="body2">
                  {filtered.length} de {summaries.length} instituciones y unidades
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Cada resultado corresponde a un equipo en un concurso, no a una clasificación
                  acumulada. Los historiales individuales estarán disponibles próximamente.
                </Typography>
                {filtered.length === 0 ? (
                  <Stack spacing={2}>
                    <Alert severity="info">
                      No hay instituciones que coincidan con esta búsqueda.
                    </Alert>
                    <Button onClick={clearSearch}>Limpiar búsqueda</Button>
                  </Stack>
                ) : (
                  <Grid aria-label="Instituciones y unidades">
                    {filtered.map((summary) => (
                      <li key={summary.school.id}>
                        <SchoolSummaryCard summary={summary} />
                      </li>
                    ))}
                  </Grid>
                )}
              </>
            )}
          </>
        )}
      </Stack>
    </Page>
  );
};
