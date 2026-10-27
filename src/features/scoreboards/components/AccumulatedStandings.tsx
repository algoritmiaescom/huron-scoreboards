import {
  Alert,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';

import { DataList, ListGrid, ScrollRegion } from '@/components';

import { QualificationChip } from './QualificationChip';
import { SchoolIdentity } from './SchoolIdentity';
import { StandingCard } from './StandingCard';
import { TeamIdentity } from './TeamIdentity';
import { selectAccumulatedRows, selectQualificationCut } from '../model/selectors';

import type { SeasonStanding } from '../model/schemas';
import type { ScoreboardsArchive } from '../repositories/scoreboardsRepository';

const ResultsTable = styled(Table)(({ theme }) => ({
  minWidth: 800,
  tableLayout: 'fixed',
  borderCollapse: 'separate',
  borderSpacing: 0,
  '& th, & td': {
    padding: theme.spacing(1.5),
    overflowWrap: 'anywhere',
    backgroundColor: theme.palette.background.paper,
  },
  '& thead th': { position: 'sticky', top: 0, zIndex: 1 },
  '& [data-qualified="true"] > *': { backgroundColor: theme.palette.scoreboard.qualified },
  '& [data-cut="true"] > *': { borderBottom: `4px solid ${theme.palette.primary.main}` },
}));

const QualifiedCard = styled(StandingCard)(({ theme }) => ({
  '&[data-qualified="true"]': { backgroundColor: theme.palette.scoreboard.qualified },
  '&[data-cut="true"]': { borderBottom: `4px solid ${theme.palette.primary.main}` },
}));

const CutLabel = styled(Typography)(({ theme }) => ({
  display: 'block',
  marginBlock: theme.spacing(1),
  '&::before': {
    content: '""',
    display: 'inline-block',
    width: theme.spacing(4),
    borderTop: `4px solid ${theme.palette.primary.main}`,
    marginRight: theme.spacing(1),
  },
}));

export const AccumulatedStandings = ({
  archive,
  standing,
}: {
  archive: ScoreboardsArchive;
  standing: SeasonStanding;
}) => {
  const desktop = useMediaQuery(useTheme().breakpoints.up('md'));
  const rows = selectAccumulatedRows(archive, standing);
  const cut = selectQualificationCut(standing);
  const label = `Clasificación acumulada ${String(standing.seasonYear)}`;
  if (rows.length === 0) {
    return (
      <Alert severity="info">
        Esta clasificación acumulada todavía no tiene equipos publicados.
      </Alert>
    );
  }
  if (!desktop) {
    return (
      <ListGrid aria-label={label}>
        {rows.map((row, index) => (
          <li key={row.teamId}>
            <QualifiedCard row={row} data-qualified={row.qualified} data-cut={cut === index + 1}>
              <DataList items={[{ label: 'Puntaje publicado', value: String(row.score) }]} />
              <QualificationChip qualified={row.qualified} />
            </QualifiedCard>
            {cut === index + 1 && (
              <CutLabel variant="caption">Línea de corte de clasificación</CutLabel>
            )}
          </li>
        ))}
      </ListGrid>
    );
  }
  return (
    <>
      <ScrollRegion label="Clasificación acumulada con desplazamiento">
        <ResultsTable aria-label={label}>
          <colgroup>
            <col width="10%" />
            <col width="25%" />
            <col width="30%" />
            <col width="15%" />
            <col width="20%" />
          </colgroup>
          <TableHead>
            <TableRow>
              <TableCell scope="col">Puesto</TableCell>
              <TableCell scope="col">Equipo</TableCell>
              <TableCell scope="col">Institución</TableCell>
              <TableCell scope="col" align="right">
                Puntaje publicado
              </TableCell>
              <TableCell scope="col">Clasificación</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow
                key={row.teamId}
                data-qualified={row.qualified}
                data-cut={cut === index + 1}
              >
                <TableCell>
                  <Typography variant="data">#{row.place}</Typography>
                </TableCell>
                <TableCell component="th" scope="row">
                  <TeamIdentity team={row.team} />
                </TableCell>
                <TableCell>
                  <SchoolIdentity school={row.school} />
                </TableCell>
                <TableCell align="right">
                  <Typography variant="data">{String(row.score)}</Typography>
                </TableCell>
                <TableCell>
                  <QualificationChip qualified={row.qualified} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </ResultsTable>
      </ScrollRegion>
      {cut !== undefined && <CutLabel variant="caption">Línea de corte de clasificación</CutLabel>}
    </>
  );
};
