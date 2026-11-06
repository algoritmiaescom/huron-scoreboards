import CloseOutlined from '@mui/icons-material/CloseOutlined';
import Search from '@mui/icons-material/Search';
import { Alert, Button, Paper, Stack, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { useLoaderData, useSearchParams } from 'react-router';

import { DocumentTitle } from '@/app/components/DocumentTitle';
import { DataLoadError, HeroBanner, PageContainer } from '@/components';
import {
  ContestHeader,
  resolveScoreboardSelection,
  type ScoreboardsArchive,
  ScoreboardSelector,
  seriesLabel,
} from '@/features/scoreboards';
import { AccumulatedHeader } from '@/features/scoreboards/components/AccumulatedHeader';
import { AccumulatedResults } from '@/features/scoreboards/components/AccumulatedResults';
import { ContestResults } from '@/features/scoreboards/components/ContestResults';
import { mexicoCityDate } from '@/lib/dates';
import { publicAssetUrl } from '@/lib/publicAsset';

import type { RepositoryResult } from '@/lib/data/repository';
import type { ReactNode } from 'react';

const Section = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  [theme.breakpoints.up('md')]: { padding: theme.spacing(3) },
}));

const Hero = styled(HeroBanner)(({ theme }) => {
  const gridLine = alpha(theme.palette.common.white, 0.045);
  return {
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      backgroundImage: `linear-gradient(${gridLine} 1px, transparent 1px), linear-gradient(90deg, ${gridLine} 1px, transparent 1px)`,
      backgroundSize: '48px 48px',
      maskImage: 'linear-gradient(90deg, black, transparent 75%)',
    },
    '&::after': {
      content: '""',
      position: 'absolute',
      width: 360,
      height: 360,
      borderRadius: '50%',
      backgroundColor: theme.palette.brand.yellow,
      opacity: 0.12,
      right: -80,
      top: -180,
    },
    '& [data-hero-title]': {
      fontSize: '3.2rem',
      [theme.breakpoints.up('md')]: { fontSize: '6.4rem' },
    },
  };
});

const HeroLogo = styled('img')(({ theme }) => ({
  alignSelf: 'flex-start',
  width: 150,
  padding: theme.spacing(3),
  filter: 'brightness(0) invert(1)',
  opacity: 0.9,
  border: `1px solid ${alpha(theme.palette.common.white, 0.18)}`,
  borderRadius: Number(theme.shape.borderRadius) * 5,
  boxShadow: `0 24px 80px ${alpha(theme.palette.common.black, 0.28)}`,
  [theme.breakpoints.up('md')]: { width: 220, transform: 'rotate(3deg)' },
  [theme.breakpoints.up('lg')]: { alignSelf: 'auto' },
}));

const Content = styled(PageContainer)(({ theme }) => ({
  paddingBlock: theme.spacing(3),
  [theme.breakpoints.up('md')]: { paddingBlock: theme.spacing(5) },
}));

const Overlap = styled('div')(({ theme }) => ({
  position: 'relative',
  zIndex: 2,
  marginTop: theme.spacing(-6),
  [theme.breakpoints.up('md')]: { marginTop: theme.spacing(-8) },
}));

/** Introduces the standings with the archive banner; status states omit it to keep their message in view. */
const ScoreboardsLayout = ({ children }: { children: ReactNode }) => (
  <>
    <Hero
      eyebrow="01 — Archivo del ICPC México"
      title="Cada solución tiene una historia."
      titleComponent="p"
      description="Explora clasificaciones oficiales por temporadas y series, preservadas por la comunidad."
      aside={<HeroLogo src={publicAssetUrl('brand/icpc-mexico.png')} alt="ICPC Masters México" />}
    />
    <Content maxWidth="xl">
      <Overlap>{children}</Overlap>
    </Content>
  </>
);

const StatusSection = ({
  maxWidth = 'md',
  children,
}: {
  maxWidth?: 'md' | 'lg';
  children: ReactNode;
}) => (
  <PageContainer maxWidth={maxWidth}>
    <DocumentTitle>Clasificaciones</DocumentTitle>
    <Section>
      <Stack spacing={2}>{children}</Stack>
    </Section>
  </PageContainer>
);

export const ScoreboardsPage = () => {
  const result = useLoaderData<RepositoryResult<ScoreboardsArchive>>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [today] = useState(() => mexicoCityDate(new Date()));

  const archive = useMemo(() => {
    if (result.status === 'ready' || result.status === 'empty') {
      return result.data;
    }
    return undefined;
  }, [result]);

  useEffect(() => {
    if (archive === undefined || result.status === 'invalid' || result.status === 'error') {
      return;
    }
    const selected = resolveScoreboardSelection(archive, searchParams, today);
    if (selected.status === 'selected') {
      if (searchParams.get('contest') === null) {
        const next = new URLSearchParams(searchParams);
        next.set('contest', selected.contest.id);
        setSearchParams(next, { replace: true });
      }
    }
  }, [archive, result, searchParams, setSearchParams, today]);

  if (result.status === 'invalid' || result.status === 'error') {
    return (
      <StatusSection maxWidth="lg">
        <DataLoadError
          title="No disponible"
          headingLevel="h1"
          message="No pudimos cargar la clasificación. La base de datos publicada tiene un problema."
          issues={result.issues}
        />
      </StatusSection>
    );
  }

  if (result.status === 'empty' || archive === undefined) {
    return (
      <StatusSection>
        <Search color="primary" fontSize="large" />
        <Typography component="h1" variant="h4">
          Todavía no hay concursos publicados
        </Typography>
        <Typography color="text.secondary">
          El archivo real está vacío en este momento. La aplicación sigue esperando resultados
          elegibles para mostrar la clasificación.
        </Typography>
      </StatusSection>
    );
  }

  const selection = resolveScoreboardSelection(archive, searchParams, today);
  const selectView = (params: URLSearchParams) => {
    setSearchParams(params, { replace: false, flushSync: true });
  };
  const selector = (
    <ScoreboardSelector
      archive={archive}
      selection={
        selection.status === 'selected' || selection.status === 'accumulated'
          ? selection
          : undefined
      }
      today={today}
      onSelect={selectView}
    />
  );

  if (selection.status === 'invalid') {
    return (
      <StatusSection>
        <Typography component="h1" variant="h4">
          Selección no disponible
        </Typography>
        <Alert severity="warning" icon={<CloseOutlined />}>
          {selection.message}
        </Alert>
        {selector}
        <Button
          variant="contained"
          onClick={() => {
            setSearchParams({}, { replace: true });
          }}
        >
          Ver el último concurso
        </Button>
      </StatusSection>
    );
  }

  if (selection.status === 'empty') {
    return (
      <StatusSection>
        <Typography component="h1" variant="h4">
          No hay concursos disponibles para la fecha actual
        </Typography>
        <Alert severity="info">
          No hay concursos disponibles para la fecha actual. Vuelve más tarde.
        </Alert>
        {selector}
      </StatusSection>
    );
  }

  if (selection.status === 'accumulated') {
    const { standing } = selection;
    return (
      <ScoreboardsLayout>
        <DocumentTitle>{`Acumulada ${String(standing.seasonYear)} - ${seriesLabel(standing.seriesId)}`}</DocumentTitle>
        <Stack spacing={3}>
          {selector}
          <AccumulatedHeader standing={standing} datasetSource={archive.source} />
          <AccumulatedResults archive={archive} standing={standing} />
        </Stack>
      </ScoreboardsLayout>
    );
  }

  const contest = selection.contest;

  return (
    <ScoreboardsLayout>
      <DocumentTitle>{contest.name}</DocumentTitle>
      <Stack spacing={3}>
        {selector}
        <ContestHeader contest={contest} datasetSource={archive.source} />
        <ContestResults archive={archive} contest={contest} />
      </Stack>
    </ScoreboardsLayout>
  );
};
