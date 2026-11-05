import Search from '@mui/icons-material/Search';
import {
  Alert,
  Button,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useMemo } from 'react';
import { useLoaderData, useSearchParams } from 'react-router';

import { DocumentTitle } from '@/app/components/DocumentTitle';
import { DataLoadError, HeroBanner, ListGrid, PageContainer } from '@/components';
import { SchoolSummaryCard } from '@/features/scoreboards/components/SchoolSummaryCard';
import {
  filterSchoolDirectory,
  selectSchoolDirectory,
  sortSchoolDirectory,
} from '@/features/scoreboards/model/schoolDirectory';

import type { ScoreboardsArchive } from '@/features/scoreboards';
import type { RepositoryResult } from '@/lib/data/repository';

const Page = styled(PageContainer)(({ theme }) => ({
  paddingBlock: theme.spacing(5),
  [theme.breakpoints.up('md')]: { paddingBlock: theme.spacing(8) },
}));

const Hero = styled(HeroBanner)(({ theme }) => ({
  '& [data-hero-title]': {
    maxWidth: 1140,
    marginBottom: theme.spacing(1),
    fontSize: '3.1rem',
    [theme.breakpoints.up('md')]: { fontSize: '6rem' },
  },
  [theme.breakpoints.up('lg')]: {
    '&::after': {
      content: '""',
      position: 'absolute',
      width: theme.spacing(15),
      height: theme.spacing(15),
      border: `${theme.spacing(2)} solid ${theme.palette.brand.yellow}`,
      borderRadius: '50%',
      right: theme.spacing(8),
      top: theme.spacing(8),
      opacity: 0.75,
    },
  },
}));

const DirectoryControls = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(6),
  [theme.breakpoints.up('lg')]: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
  },
}));

const SearchPanel = styled('div')(({ theme }) => ({
  width: '100%',
  maxWidth: 680,
  minWidth: 0,
  padding: theme.spacing(1),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[3],
}));

const SortButtons = styled('div')(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
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
  const sort = params.get('sort') ?? 'participations';
  const filtered = sortSchoolDirectory(
    filterSchoolDirectory(summaries, query),
    sort === 'place' ? 'place' : 'participations',
  );
  const invalidQuery =
    params.getAll('q').length > 1 ||
    params.getAll('sort').length > 1 ||
    !['participations', 'place'].includes(sort) ||
    [...params.keys()].some((key) => key !== 'q' && key !== 'sort');
  const clearSearch = () => {
    const next = new URLSearchParams(params);
    next.delete('q');
    setParams(next, { replace: true, flushSync: true });
  };
  return (
    <>
      <DocumentTitle>Instituciones</DocumentTitle>
      <Hero
        eyebrow="02 — Instituciones participantes"
        title="Instituciones a través de cada temporada."
        description="Los equipos se registran para una temporada. Los perfiles de las instituciones son el hilo estable para entender el rendimiento a largo plazo."
      />
      <Page maxWidth="xl">
        <Stack spacing={6}>
          {result.status === 'invalid' || result.status === 'error' ? (
            <DataLoadError
              message="No pudimos cargar las instituciones. La base de datos publicada tiene un problema."
              issues={result.issues}
            />
          ) : summaries.length === 0 ? (
            <Alert severity="info">Todavía no hay instituciones publicadas en este archivo.</Alert>
          ) : (
            <>
              {result.data.source === 'mock' && (
                <Alert severity="warning">
                  Datos de demostración: las estadísticas provienen de resultados inventados.
                </Alert>
              )}
              <DirectoryControls>
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
                <SortButtons role="group" aria-label="Ordenar instituciones">
                  {[
                    ['participations', 'Más participaciones'],
                    ['place', 'Mejor puesto'],
                  ].map(([value, label]) => (
                    <ToggleButton
                      key={value}
                      value={value}
                      selected={sort === value}
                      onClick={() => {
                        const next = new URLSearchParams(params);
                        if (value === 'participations') {
                          next.delete('sort');
                        } else {
                          next.set('sort', value);
                        }
                        setParams(next, {
                          replace: true,
                          flushSync: true,
                          preventScrollReset: true,
                        });
                      }}
                    >
                      {label}
                    </ToggleButton>
                  ))}
                </SortButtons>
              </DirectoryControls>
              {invalidQuery ? (
                <Stack spacing={2}>
                  <Alert severity="warning">
                    La búsqueda contiene parámetros repetidos o desconocidos.
                  </Alert>
                  <Button
                    onClick={() => {
                      setParams({}, { replace: true, flushSync: true });
                    }}
                  >
                    Restablecer búsqueda
                  </Button>
                </Stack>
              ) : (
                <>
                  <Typography role="status" variant="body2">
                    {filtered.length} de {summaries.length} instituciones y unidades
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Cada resultado corresponde a un equipo en un concurso, no a una clasificación
                    acumulada. El mejor puesto usa los puestos publicados en concursos; los
                    desconocidos aparecen al final. En instituciones con unidades se incluyen sus
                    resultados.
                  </Typography>
                  {filtered.length === 0 ? (
                    <Stack spacing={2}>
                      <Alert severity="info">
                        No hay instituciones que coincidan con esta búsqueda.
                      </Alert>
                      <Button onClick={clearSearch}>Limpiar búsqueda</Button>
                    </Stack>
                  ) : (
                    <ListGrid
                      as="ul"
                      columns={{ sm: 2, lg: 3 }}
                      spacing={3}
                      aria-label="Instituciones y unidades"
                    >
                      {filtered.map((summary) => (
                        <li key={summary.school.id}>
                          <SchoolSummaryCard summary={summary} />
                        </li>
                      ))}
                    </ListGrid>
                  )}
                </>
              )}
            </>
          )}
        </Stack>
      </Page>
    </>
  );
};
