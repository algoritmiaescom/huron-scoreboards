import { Card, CardContent, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

import type { SchoolHistory } from '../model/schoolHistory';

const SeasonList = styled('ol')(({ theme }) => ({
  display: 'grid',
  gap: theme.spacing(2),
  listStyle: 'none',
  margin: theme.spacing(3, 0, 0),
  padding: 0,
}));

const SeasonHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: theme.spacing(1),
  flexWrap: 'wrap',
}));

const SeasonName = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
}));

const Track = styled('div')(({ theme }) => ({
  height: theme.spacing(1.25),
  marginTop: theme.spacing(1),
  overflow: 'hidden',
  borderRadius: 999,
  backgroundColor: theme.palette.action.hover,
}));

const Bar = styled('div')(({ theme }) => ({
  height: '100%',
  borderRadius: 'inherit',
  backgroundColor: theme.palette.primary.main,
}));

export const SchoolParticipationChart = ({ seasons }: { seasons: SchoolHistory['seasons'] }) => {
  const maxSolved = Math.max(...seasons.map(({ solved }) => solved), 0);
  const progressMax = Math.max(maxSolved, 1);

  return (
    <Card>
      <CardContent>
        <Typography variant="overline" color="primary">
          Volumen
        </Typography>
        <Typography component="h2" variant="h5">
          Participación y problemas resueltos
        </Typography>
        <SeasonList aria-label="Participación y problemas resueltos por temporada">
          {seasons.map(({ seasonYear, teams, solved }) => (
            <li key={seasonYear}>
              <SeasonHeader>
                <SeasonName variant="body2">Temporada {seasonYear}</SeasonName>
                <Typography variant="body2">
                  {teams} {teams === 1 ? 'equipo' : 'equipos'} · {solved}{' '}
                  {solved === 1 ? 'problema resuelto' : 'problemas resueltos'}
                </Typography>
              </SeasonHeader>
              <Track
                role="progressbar"
                aria-label={`Problemas resueltos en la temporada ${String(seasonYear)}`}
                aria-valuemin={0}
                aria-valuemax={progressMax}
                aria-valuenow={solved}
              >
                <Bar style={{ width: `${String((solved / progressMax) * 100)}%` }} />
              </Track>
            </li>
          ))}
        </SeasonList>
      </CardContent>
    </Card>
  );
};
