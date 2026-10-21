import { Breadcrumbs, Card, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

import { SourceCallout } from './SourceCallout';
import { seriesLabel } from '../model/selectors';

import type { SeasonStanding } from '../model/schemas';
import type { DatasetSource } from '@/lib/data/repository';

const Header = styled(Card)(({ theme }) => ({
  minWidth: 0,
  overflowWrap: 'anywhere',
  borderTop: `4px solid ${theme.palette.brand.yellow}`,
}));

const Content = styled('div')(({ theme }) => ({
  padding: theme.spacing(2.5),
  '& h1': { marginBlock: theme.spacing(1, 2) },
  [theme.breakpoints.up('md')]: { padding: theme.spacing(4) },
}));

export const AccumulatedHeader = ({
  standing,
  datasetSource,
}: {
  standing: SeasonStanding;
  datasetSource: DatasetSource;
}) => (
  <Header>
    <Content>
      <Breadcrumbs aria-label="Jerarquía de la clasificación acumulada">
        <Typography variant="body2">Temporada {standing.seasonYear}</Typography>
        <Typography variant="body2">{seriesLabel(standing.seriesId)}</Typography>
        <Typography variant="body2">Acumulada</Typography>
      </Breadcrumbs>
      <Typography variant="overline" color="primary">
        {datasetSource === 'mock' ? 'Clasificación de demostración' : 'Archivo de resultados'}
      </Typography>
      <Typography component="h1" variant="h3">
        Clasificación acumulada {standing.seasonYear}
      </Typography>
      <Typography color="text.secondary">
        {datasetSource === 'mock'
          ? 'Los puntajes y estados de clasificación de esta demostración son inventados.'
          : 'Puntajes y estados de clasificación publicados en la fuente. Huron Scoreboards no calcula estos puntajes.'}
      </Typography>
    </Content>
    <SourceCallout source={standing.source} datasetSource={datasetSource} />
  </Header>
);
