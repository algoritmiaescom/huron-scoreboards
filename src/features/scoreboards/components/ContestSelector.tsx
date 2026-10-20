import { Paper, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

import { selectCatalog, selectLatestHeldContest } from '../model/selectors';

import type { Contest } from '../model/schemas';
import type { ScoreboardsArchive } from '../repositories/scoreboardsRepository';

const Controls = styled(Paper)(({ theme }) => ({
  position: 'relative',
  padding: theme.spacing(2),
  display: 'grid',
  gap: theme.spacing(2),
  gridTemplateColumns: 'minmax(0, 1fr)',
  [theme.breakpoints.up('md')]: {
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.5fr) minmax(0, 2fr)',
  },
}));

const Field = styled('div')({ minWidth: 0 });
const Select = styled('select')(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.palette.text.primary,
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  width: '100%',
  minHeight: theme.spacing(5.5),
  padding: theme.spacing(1, 1.5),
  marginTop: theme.spacing(0.5),
  textOverflow: 'ellipsis',
}));

export const ContestSelector = ({
  archive,
  contest,
  today,
  onSelect,
}: {
  archive: ScoreboardsArchive;
  contest?: Contest;
  today: string;
  onSelect: (id: string) => void;
}) => {
  const catalog = selectCatalog(archive)
    .map((season) => ({
      ...season,
      series: season.series.filter((series) => series.contests.length > 0),
    }))
    .filter((season) => season.series.length > 0);
  const season = catalog.find(({ seasonYear }) => seasonYear === contest?.seasonYear);
  const series = season?.series.find(({ id }) => id === contest?.seriesId);
  const selectGroup = (contests: Contest[]) => {
    if (contests.length === 0) {
      throw new Error('ContestSelector requires a nonempty contest group.');
    }
    const latest = selectLatestHeldContest({ ...archive, contests }, today);
    const next = latest.status === 'found' ? latest.record : contests[0];
    onSelect(next.id);
  };
  return (
    <Controls variant="outlined" aria-label="Selección de concurso">
      <Field>
        <Typography component="label" htmlFor="contest-season" variant="body2">
          Temporada
        </Typography>
        <Select
          id="contest-season"
          value={season?.seasonYear ?? ''}
          onChange={(event) => {
            selectGroup(
              archive.contests.filter(
                ({ seasonYear }) => String(seasonYear) === event.target.value,
              ),
            );
          }}
        >
          <option value="" disabled>
            Elige una temporada
          </option>
          {catalog.map(({ seasonYear }) => (
            <option key={seasonYear} value={seasonYear}>
              {seasonYear}
            </option>
          ))}
        </Select>
      </Field>
      <Field>
        <Typography component="label" htmlFor="contest-series" variant="body2">
          Serie
        </Typography>
        <Select
          id="contest-series"
          value={series?.id ?? ''}
          disabled={season === undefined}
          onChange={(event) => {
            selectGroup(
              archive.contests.filter(
                (candidate) =>
                  candidate.seasonYear === season?.seasonYear &&
                  candidate.seriesId === event.target.value,
              ),
            );
          }}
        >
          <option value="" disabled>
            Elige una serie
          </option>
          {season?.series.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <Field>
        <Typography component="label" htmlFor="contest-stage" variant="body2">
          Concurso
        </Typography>
        <Select
          id="contest-stage"
          value={contest?.id ?? ''}
          disabled={series === undefined}
          onChange={(event) => {
            onSelect(event.target.value);
          }}
        >
          <option value="" disabled>
            Elige un concurso
          </option>
          {series?.contests.map(({ id, name, stageLabel }) => (
            <option key={id} value={id}>
              {stageLabel} — {name}
            </option>
          ))}
        </Select>
      </Field>
    </Controls>
  );
};
