import Bolt from '@mui/icons-material/Bolt';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import Search from '@mui/icons-material/Search';
import { InputAdornment, TextField, ToggleButton } from '@mui/material';
import { styled } from '@mui/material/styles';

import type { Contest, School } from '../model/schemas';
import type { StandingsFilters } from '../model/selectors';
import type { FilterKey } from '../model/standingsFilters';

const Controls = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: theme.spacing(2),
  '& > *': { minWidth: 0 },
  [theme.breakpoints.up('sm')]: {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  },
  [theme.breakpoints.up('lg')]: {
    gridTemplateColumns: 'minmax(180px, 1.5fr) minmax(160px, 1fr) minmax(140px, 1fr) auto auto',
  },
}));

const Toggle = styled(ToggleButton)(({ theme }) => ({
  gap: theme.spacing(1),
  minHeight: theme.spacing(5.5),
  textTransform: 'none',
}));

export const ScoreboardFilters = ({
  filters,
  schools,
  contest,
  onChange,
}: {
  filters: StandingsFilters;
  schools: School[];
  contest: Contest;
  onChange: (key: FilterKey, value: string) => void;
}) => (
  <Controls role="group" aria-label="Filtros de clasificación">
    <TextField
      label="Nombre del equipo"
      size="small"
      value={filters.team ?? ''}
      onChange={(event) => {
        onChange('team', event.target.value);
      }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <Search />
            </InputAdornment>
          ),
        },
      }}
    />
    <TextField
      select
      label="Institución"
      size="small"
      value={filters.school ?? ''}
      slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
      onChange={(event) => {
        onChange('school', event.target.value);
      }}
    >
      <option value="">Todas las instituciones</option>
      {schools.map((school) => (
        <option key={school.id} value={school.id}>
          {school.shortName}
        </option>
      ))}
    </TextField>
    <TextField
      select
      label="Problema"
      size="small"
      value={filters.problem ?? ''}
      slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
      onChange={(event) => {
        onChange('problem', event.target.value);
      }}
    >
      <option value="">Todos los problemas</option>
      {contest.problems.map(({ label, title }) => (
        <option key={label} value={label}>
          {title === undefined ? label : `${label} - ${title}`}
        </option>
      ))}
    </TextField>
    <Toggle
      value="accepted"
      selected={filters.accepted === true}
      onChange={() => {
        onChange('accepted', filters.accepted === true ? '' : '1');
      }}
    >
      <CheckCircleOutlined fontSize="small" /> Resuelto
    </Toggle>
    <Toggle
      value="first"
      selected={filters.first === true}
      onChange={() => {
        onChange('first', filters.first === true ? '' : '1');
      }}
    >
      <Bolt fontSize="small" /> Primero en resolver
    </Toggle>
  </Controls>
);
