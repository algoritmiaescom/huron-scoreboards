import CloseOutlined from '@mui/icons-material/CloseOutlined';
import ErrorOutlined from '@mui/icons-material/ErrorOutlined';
import Search from '@mui/icons-material/Search';
import { Alert, Button, Container, Paper, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { useLoaderData, useSearchParams } from 'react-router';

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

import type { RepositoryResult } from '@/lib/data/repository';

const Page = styled(Container)(({ theme }) => ({
  paddingBlock: theme.spacing(4),
  overflowWrap: 'anywhere',
  [theme.breakpoints.up('md')]: { paddingBlock: theme.spacing(6) },
}));

const Section = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  [theme.breakpoints.up('md')]: { padding: theme.spacing(3) },
}));

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
      <Page maxWidth="lg">
        <title>Clasificaciones | Huron Scoreboards</title>
        <Section>
          <Stack spacing={2}>
            <Alert severity="error" icon={<ErrorOutlined />}>
              No pudimos cargar la clasificación. La base de datos publicada tiene un problema.
            </Alert>
            <Typography component="h1" variant="h4">
              No disponible
            </Typography>
            <ul>
              {result.issues.map((issue) => (
                <li key={`${issue.file}:${issue.location}:${issue.message}`}>
                  <Typography variant="body2">
                    {issue.file}: {issue.message}
                  </Typography>
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
        </Section>
      </Page>
    );
  }

  if (result.status === 'empty' || archive === undefined) {
    return (
      <Page maxWidth="md">
        <title>Clasificaciones | Huron Scoreboards</title>
        <Section>
          <Stack spacing={2}>
            <Search color="primary" fontSize="large" />
            <Typography component="h1" variant="h4">
              Todavía no hay concursos publicados
            </Typography>
            <Typography color="text.secondary">
              El archivo real está vacío en este momento. La aplicación sigue esperando resultados
              elegibles para mostrar la clasificación.
            </Typography>
          </Stack>
        </Section>
      </Page>
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
      <Page maxWidth="md">
        <title>Clasificaciones | Huron Scoreboards</title>
        <Section>
          <Stack spacing={2}>
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
          </Stack>
        </Section>
      </Page>
    );
  }

  if (selection.status === 'empty') {
    return (
      <Page maxWidth="md">
        <title>Clasificaciones | Huron Scoreboards</title>
        <Section>
          <Stack spacing={2}>
            <Typography component="h1" variant="h4">
              No hay concursos disponibles para la fecha actual
            </Typography>
            <Alert severity="info">
              No hay concursos disponibles para la fecha actual. Vuelve más tarde.
            </Alert>
            {selector}
          </Stack>
        </Section>
      </Page>
    );
  }

  if (selection.status === 'accumulated') {
    const { standing } = selection;
    return (
      <Page maxWidth="xl">
        <title>{`Acumulada ${String(standing.seasonYear)} - ${seriesLabel(standing.seriesId)} | Huron Scoreboards`}</title>
        <Stack spacing={3}>
          <AccumulatedHeader standing={standing} datasetSource={archive.source} />
          {selector}
          <AccumulatedResults archive={archive} standing={standing} />
        </Stack>
      </Page>
    );
  }

  const contest = selection.contest;

  return (
    <Page maxWidth="xl">
      <title>{`${contest.name} | Huron Scoreboards`}</title>
      <Stack spacing={3}>
        <ContestHeader contest={contest} datasetSource={archive.source} />
        {selector}
        <ContestResults archive={archive} contest={contest} />
      </Stack>
    </Page>
  );
};
