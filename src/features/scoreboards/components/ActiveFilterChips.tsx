import { Chip } from '@mui/material';
import { styled } from '@mui/material/styles';

import { filterKeys } from '../model/standingsFilters';

import type { FilterKey } from '../model/standingsFilters';
import type { ScoreboardsArchive } from '../repositories/scoreboardsRepository';

const Chips = styled('div')(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
  minWidth: 0,
}));

const FilterChip = styled(Chip)({
  maxWidth: '100%',
  height: 'auto',
  '& .MuiChip-label': { whiteSpace: 'normal', overflowWrap: 'anywhere', paddingBlock: 8 },
  '& .MuiChip-deleteIcon': { flexShrink: 0 },
});

const filterLabel = (key: FilterKey, value: string, archive: ScoreboardsArchive): string => {
  switch (key) {
    case 'team':
      return `Equipo: ${value}`;
    case 'school': {
      const school = archive.schools.find(({ id }) => id === value);
      return `Institución: ${school?.shortName ?? school?.officialName ?? value}`;
    }
    case 'problem':
      return `Problema ${value}`;
    case 'accepted':
      return value === '1' ? 'Resuelto' : `Resuelto: ${value}`;
    case 'first':
      return value === '1' ? 'Primero en resolver' : `Primero en resolver: ${value}`;
  }
};

export const ActiveFilterChips = ({
  params,
  archive,
  onRemove,
}: {
  params: URLSearchParams;
  archive: ScoreboardsArchive;
  onRemove: (key: FilterKey) => void;
}) => (
  <Chips role="group" aria-label="Filtros activos">
    {filterKeys
      .filter((key) => params.has(key))
      .map((key) => {
        const label = filterLabel(key, params.getAll(key).join(', '), archive);
        return (
          <FilterChip
            key={key}
            label={label}
            aria-label={`Quitar filtro ${label}`}
            onClick={() => {
              onRemove(key);
            }}
            onDelete={() => {
              onRemove(key);
            }}
            size="small"
            color="primary"
            variant="outlined"
          />
        );
      })}
  </Chips>
);
