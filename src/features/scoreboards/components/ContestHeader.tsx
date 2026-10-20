import { Breadcrumbs, Card, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

import { SourceCallout } from './SourceCallout';
import { contestStageLabel, seriesLabel } from '../model/selectors';

import type { Contest } from '../model/schemas';
import type { DatasetSource } from '@/lib/data/repository';

const Header = styled(Card)(({ theme }) => ({
  minWidth: 0,
  overflowWrap: 'anywhere',
  borderTop: `4px solid ${theme.palette.brand.yellow}`,
}));

const Content = styled('div')(({ theme }) => ({
  padding: theme.spacing(2.5),
  [theme.breakpoints.up('md')]: { padding: theme.spacing(4) },
}));

const Title = styled(Typography)(({ theme }) => ({
  marginBlock: theme.spacing(1, 2),
}));

const Metadata = styled('ul')(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
  listStyle: 'none',
  padding: 0,
  margin: theme.spacing(2, 0, 0),
  '& li': {
    padding: theme.spacing(0.5, 1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.spacing(8),
    maxWidth: '100%',
  },
}));

const formatContestDate = (date: string) =>
  new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));

export const ContestHeader = ({
  contest,
  datasetSource,
  headingLevel = 'h1',
}: {
  contest: Contest;
  datasetSource: DatasetSource;
  headingLevel?: 'h1' | 'h2';
}) => (
  <Header>
    <Content>
      <Breadcrumbs aria-label="Jerarquía del concurso">
        <Typography variant="body2">Temporada {contest.seasonYear}</Typography>
        <Typography variant="body2">{seriesLabel(contest.seriesId)}</Typography>
        <Typography variant="body2">{contestStageLabel(contest.stage)}</Typography>
      </Breadcrumbs>
      <Typography variant="overline" color="primary">
        {datasetSource === 'mock' ? 'Concurso de demostración' : 'Archivo de resultados'}
      </Typography>
      <Title variant="h3" variantMapping={{ h3: headingLevel }}>
        {contest.name}
      </Title>
      <Metadata aria-label="Datos del concurso">
        <li>
          <time dateTime={contest.date}>{formatContestDate(contest.date)}</time>
        </li>
        <li>{contest.durationMinutes} min</li>
        <li>Penalización: +{contest.penaltyMinutesPerFailedAttempt} min por intento fallido</li>
        <li>{contest.problems.length} problemas</li>
      </Metadata>
    </Content>
    <SourceCallout source={contest.source} datasetSource={datasetSource} />
  </Header>
);
