import CloseOutlined from '@mui/icons-material/CloseOutlined';
import ErrorOutlined from '@mui/icons-material/ErrorOutlined';
import Search from '@mui/icons-material/Search';
import { Alert, Button, Container, Paper, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { useLoaderData, useSearchParams } from 'react-router';

import { ContestHeader } from '@/features/scoreboards/components/ContestHeader';
import { ContestSelector } from '@/features/scoreboards/components/ContestSelector';
import { ContestStandings } from '@/features/scoreboards/components/ContestStandings';
import { ResultsLegend } from '@/features/scoreboards/components/ResultsLegend';
import { resolveContestSelection } from '@/features/scoreboards/model/contestSelection';
import { mexicoCityDate } from '@/lib/dates';

import type { ScoreboardsArchive } from '@/features/scoreboards';
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
    const selected = resolveContestSelection(archive, searchParams, today);
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

  const selection = resolveContestSelection(archive, searchParams, today);

  if (selection.status === 'invalid' || selection.status === 'unavailable') {
    return (
      <Page maxWidth="md">
        <title>Clasificaciones | Huron Scoreboards</title>
        <Section>
          <Stack spacing={2}>
            <Alert severity="warning" icon={<CloseOutlined />}>
              {selection.message}
            </Alert>
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
            <Alert severity="info">
              No hay concursos disponibles para la fecha actual. Vuelve más tarde.
            </Alert>
          </Stack>
        </Section>
      </Page>
    );
  }

  const contest = (selection as Extract<typeof selection, { status: 'selected' }>).contest;
  const selectContest = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('contest', id);
    setSearchParams(next, { replace: false });
  };

  return (
    <Page maxWidth="xl">
      <title>{contest.name} | Huron Scoreboards</title>
      <Stack spacing={3}>
        <ContestHeader contest={contest} datasetSource={archive.source} />
        <ContestSelector
          archive={archive}
          contest={contest}
          today={today}
          onSelect={selectContest}
        />
        <ResultsLegend />
        <ContestStandings archive={archive} contest={contest} />
      </Stack>
    </Page>
  );
};
