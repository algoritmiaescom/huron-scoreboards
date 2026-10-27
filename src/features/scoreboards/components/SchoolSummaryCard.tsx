import ArrowForward from '@mui/icons-material/ArrowForward';
import SchoolOutlined from '@mui/icons-material/SchoolOutlined';
import { Card, Chip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

import { DataList } from '@/components';

import { SchoolIdentity } from './SchoolIdentity';

import type { SchoolSummary } from '../model/schoolDirectory';

const Summary = styled(Card)(({ theme }) => ({
  position: 'relative',
  height: '100%',
  padding: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  minWidth: 0,
  overflowWrap: 'anywhere',
}));

const BadgeRow = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: theme.spacing(1),
  '& .MuiChip-root': { height: 'auto', minHeight: theme.spacing(4) },
  '& .MuiChip-label': { whiteSpace: 'normal', paddingBlock: theme.spacing(0.5) },
}));

const SchoolBadge = styled('div')(({ theme }) => ({
  width: theme.spacing(6),
  height: theme.spacing(6),
  flexShrink: 0,
  display: 'grid',
  placeItems: 'center',
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.brand.yellow,
  color: theme.palette.brand.navy,
  transform: 'rotate(-6deg)',
}));

const Footer = styled('div')(({ theme }) => ({
  marginTop: 'auto',
  paddingTop: theme.spacing(1),
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
}));

const Stats = styled(DataList)(({ theme }) => ({
  flex: 1,
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  '& dd': { fontSize: theme.typography.h6.fontSize },
}));

export const SchoolSummaryCard = ({ summary }: { summary: SchoolSummary }) => {
  const { school, scope, units, bestPlace, results, contests } = summary;
  const scopeLabel =
    scope === 'school'
      ? 'Unidad académica'
      : units === 0
        ? 'Sin unidades registradas'
        : `${String(units)} ${units === 1 ? 'unidad académica' : 'unidades académicas'}`;
  return (
    <Summary role="article" aria-label={school.shortName}>
      <BadgeRow>
        <SchoolBadge>
          <SchoolOutlined aria-hidden="true" />
        </SchoolBadge>
        <Chip label={scopeLabel} size="small" variant="outlined" />
      </BadgeRow>
      <SchoolIdentity school={school} heading="h2" href={`/schools/${school.id}`} stretchLink />
      <Typography variant="caption" color="text.secondary">
        {scope === 'institution' && units > 0
          ? 'Incluye resultados propios y de todas sus unidades académicas.'
          : 'Solo resultados de esta escuela, sin agregar otras unidades.'}
      </Typography>
      <Footer>
        <Stats
          items={[
            {
              label: 'Mejor puesto',
              value: bestPlace === undefined ? 'Sin resultados' : `#${String(bestPlace)}`,
            },
            { label: 'Resultados de equipos', value: results },
          ]}
        />
        <ArrowForward color="primary" aria-hidden="true" />
      </Footer>
      <Typography variant="caption" color="text.secondary">
        {contests === 1 ? '1 concurso publicado' : `${String(contests)} concursos publicados`}
      </Typography>
    </Summary>
  );
};
