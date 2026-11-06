import { Paper, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

import { accumulatedSelectionParams, contestSelectionParams } from '../model/scoreboardSelection';
import { selectCatalog } from '../model/selectors';

import type { SelectedScoreboard } from '../model/scoreboardSelection';
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

export const ScoreboardSelector = ({
  archive,
  selection,
  today,
  onSelect,
}: {
  archive: ScoreboardsArchive;
  selection?: SelectedScoreboard;
  today: string;
  onSelect: (params: URLSearchParams) => void;
}) => {
  const catalog = selectCatalog(archive);
  const selected = selection?.status === 'selected' ? selection.contest : selection?.standing;
  const season = catalog.find(({ seasonYear }) => seasonYear === selected?.seasonYear);
  const series = season?.series.find(({ id }) => id === selected?.seriesId);
  const selectGroup = (seasonYear: number, seriesId?: string) => {
    const selectedSeries =
      catalog
        .find(({ seasonYear: candidateYear }) => candidateYear === seasonYear)
        ?.series.filter((candidate) => seriesId === undefined || candidate.id === seriesId) ?? [];
    const selectedSeriesWithContest = selectedSeries.find(
      (candidate) => candidate.contests.length > 0,
    );
    const selectedSeriesWithStanding = selectedSeries.find((candidate) => candidate.accumulated);
    if (
      selectedSeriesWithStanding !== undefined &&
      (selection?.status === 'accumulated' || selectedSeriesWithContest === undefined)
    ) {
      onSelect(accumulatedSelectionParams(seasonYear, selectedSeriesWithStanding.id));
      return;
    }
    const contests = selectedSeries.flatMap(({ contests: entries }) => entries);
    const next =
      contests
        .filter((contest) => contest.date !== null && contest.date <= today)
        .toSorted((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.id.localeCompare(b.id))
        .at(0) ?? contests.at(0);
    if (next === undefined) {
      throw new Error('ScoreboardSelector requires a published contest or season standing.');
    }
    onSelect(contestSelectionParams(next.id));
  };
  return (
    <Controls variant="outlined" aria-label="Selección de clasificación">
      <Field>
        <Typography component="label" htmlFor="contest-season" variant="body2">
          Temporada
        </Typography>
        <Select
          id="contest-season"
          value={season?.seasonYear ?? ''}
          onChange={(event) => {
            selectGroup(Number(event.target.value));
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
            if (season === undefined) {
              throw new Error('Select a season before selecting a series.');
            }
            selectGroup(season.seasonYear, event.target.value);
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
          Clasificación
        </Typography>
        <Select
          id="contest-stage"
          value={
            selection?.status === 'accumulated' ? 'accumulated' : (selection?.contest.id ?? '')
          }
          disabled={series === undefined}
          onChange={(event) => {
            if (event.target.value === 'accumulated') {
              if (season === undefined || series === undefined) {
                throw new Error('Select a season and series before an accumulated standing.');
              }
              onSelect(accumulatedSelectionParams(season.seasonYear, series.id));
            } else {
              onSelect(contestSelectionParams(event.target.value));
            }
          }}
        >
          <option value="" disabled>
            Elige una clasificación
          </option>
          {series?.contests.map(({ id, name, stageLabel }) => (
            <option key={id} value={id}>
              {stageLabel} — {name}
            </option>
          ))}
          {series?.accumulated === true && (
            <option value="accumulated">Clasificación acumulada</option>
          )}
        </Select>
      </Field>
    </Controls>
  );
};
