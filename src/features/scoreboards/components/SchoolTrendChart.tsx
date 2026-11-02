import { Card, CardContent, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

import { DataList, ListGrid, SectionTitle } from '@/components';

import { formatPlace } from '../model/ranking';

import type { SchoolHistory } from '../model/schoolHistory';

const Chart = styled('svg')(({ theme }) => ({
  display: 'block',
  width: '100%',
  height: 'auto',
  overflow: 'visible',
  color: theme.palette.primary.main,
  '& .grid-line': { stroke: theme.palette.divider },
  '& .axis-label': {
    fill: theme.palette.text.secondary,
    fontFamily: theme.typography.fontFamily,
    fontSize: 14,
  },
}));

const Values = styled(ListGrid)(({ theme }) => ({
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 10rem), 1fr))',
  marginTop: theme.spacing(2),
}));

const Season = styled(DataList)(({ theme }) => ({
  padding: theme.spacing(1.5),
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: theme.spacing(0.5, 1),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  '& > div': { display: 'contents' },
}));

const rankTicks = (maxRank: number) => {
  const step = Math.max(1, Math.ceil((maxRank - 1) / 7));
  const ticks = Array.from({ length: Math.floor((maxRank - 1) / step) + 1 }, (_, index) => {
    return 1 + index * step;
  });
  return ticks.at(-1) === maxRank ? ticks : [...ticks, maxRank];
};

export const SchoolTrendChart = ({ seasons }: { seasons: SchoolHistory['seasons'] }) => {
  const rankedSeasons = seasons.flatMap((season) =>
    season.bestPlace === undefined ? [] : [{ ...season, bestPlace: season.bestPlace }],
  );
  const width = 640;
  const height = 280;
  const left = 46;
  const right = 12;
  const top = 12;
  const bottom = 34;
  const maxPlace = Math.max(1, ...rankedSeasons.map(({ bestPlace }) => bestPlace));
  const maxRank = Math.max(8, maxPlace);
  const ticks = rankTicks(maxRank);
  const x = (index: number) =>
    rankedSeasons.length <= 1
      ? (left + width - right) / 2
      : left + (index / (rankedSeasons.length - 1)) * (width - left - right);
  const y = (place: number) => top + ((place - 1) / (maxRank - 1)) * (height - top - bottom);
  const points = rankedSeasons
    .map(({ bestPlace }, index) => `${String(x(index))},${String(y(bestPlace))}`)
    .join(' ');

  return (
    <Card>
      <CardContent>
        <SectionTitle eyebrow="Tendencia" title="Mejor puesto por temporada" />
        <Typography color="text.secondary" variant="body2">
          Un valor menor es mejor. Enfoca o pasa el cursor sobre un punto para ver su valor.
        </Typography>
        <Chart
          viewBox={`0 0 ${String(width)} ${String(height)}`}
          role="img"
          aria-labelledby="school-trend-title school-trend-description"
        >
          <title id="school-trend-title">Tendencia del mejor puesto por temporada</title>
          <desc id="school-trend-description">
            {seasons
              .map(
                ({ seasonYear, bestPlace }) => `${String(seasonYear)}: ${formatPlace(bestPlace)}`,
              )
              .join('; ')}
          </desc>
          {ticks.map((rank) => (
            <g key={rank}>
              <line className="grid-line" x1={left} y1={y(rank)} x2={width - right} y2={y(rank)} />
              <text
                className="axis-label rank-label"
                x={left - 8}
                y={y(rank)}
                dominantBaseline="middle"
                textAnchor="end"
              >
                {rank}
              </text>
            </g>
          ))}
          {rankedSeasons.length > 1 && (
            <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" />
          )}
          {rankedSeasons.map(({ seasonYear, bestPlace }, index) => (
            <g key={seasonYear} data-season={seasonYear} data-place={bestPlace}>
              <circle
                cx={x(index)}
                cy={y(bestPlace)}
                r="6"
                fill="currentColor"
                tabIndex={0}
                aria-label={`${String(seasonYear)}: puesto ${String(bestPlace)}`}
              >
                <title>
                  {seasonYear}: puesto {bestPlace}
                </title>
              </circle>
              <text className="axis-label" x={x(index)} y={height - 8} textAnchor="middle">
                {seasonYear}
              </text>
            </g>
          ))}
        </Chart>
        <Values spacing={1.5} aria-label="Valores exactos de la tendencia">
          {seasons.map(({ seasonYear, bestPlace, results, contests, podiums }) => (
            <li key={seasonYear}>
              <Season
                items={[
                  { label: 'Temporada', value: seasonYear },
                  { label: 'Mejor puesto', value: formatPlace(bestPlace) },
                  { label: 'Participaciones', value: results },
                  { label: 'Concursos', value: contests },
                  { label: 'Podios', value: podiums.length },
                ]}
              />
            </li>
          ))}
        </Values>
        {rankedSeasons.length === 0 && (
          <Typography color="text.secondary">
            La fuente no publica puestos para construir una tendencia.
          </Typography>
        )}
        {rankedSeasons.length === 1 && (
          <Typography color="text.secondary" variant="caption">
            Solo hay datos de una temporada; la gráfica muestra un punto y no implica una tendencia.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};
