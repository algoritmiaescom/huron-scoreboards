import SchoolOutlined from '@mui/icons-material/SchoolOutlined';
import { Card, Chip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

import { SchoolIdentity } from './SchoolIdentity';

import type { SchoolSummary } from '../model/schoolDirectory';

const Summary = styled(Card)(({ theme }) => ({
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

const Stats = styled('dl')(({ theme }) => ({
  margin: 0,
  marginTop: 'auto',
  paddingTop: theme.spacing(1),
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: theme.spacing(2),
  '& dt': { ...theme.typography.caption, color: theme.palette.text.secondary },
  '& dd': { ...theme.typography.data, fontSize: theme.typography.h6.fontSize, margin: 0 },
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
      <SchoolIdentity school={school} heading />
      <Typography variant="caption" color="text.secondary">
        {scope === 'institution' && units > 0
          ? 'Incluye resultados propios y de todas sus unidades académicas.'
          : 'Solo resultados de esta escuela, sin agregar otras unidades.'}
      </Typography>
      <Stats>
        <div>
          <dt>Mejor puesto</dt>
          <dd>{bestPlace === undefined ? 'Sin resultados' : `#${String(bestPlace)}`}</dd>
        </div>
        <div>
          <dt>Resultados de equipos</dt>
          <dd>{results}</dd>
        </div>
      </Stats>
      <Typography variant="caption" color="text.secondary">
        {contests === 1 ? '1 concurso publicado' : `${String(contests)} concursos publicados`}
      </Typography>
    </Summary>
  );
};
