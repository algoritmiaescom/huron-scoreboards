import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import Remove from '@mui/icons-material/Remove';
import {
  Alert,
  Card,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';

import { SchoolIdentity } from './SchoolIdentity';
import { TeamIdentity } from './TeamIdentity';
import { selectAccumulatedRows, selectQualificationCut } from '../model/selectors';

import type { SeasonStanding } from '../model/schemas';
import type { ScoreboardsArchive } from '../repositories/scoreboardsRepository';

const ScrollRegion = styled('div')(({ theme }) => ({
  overflow: 'auto',
  maxHeight: '72dvh',
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
}));

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

const Cards = styled('ol')(({ theme }) => ({
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'grid',
  gap: theme.spacing(2),
}));

const MobileCard = styled(Card)(({ theme }) => ({
  padding: theme.spacing(2),
  minWidth: 0,
  overflowWrap: 'anywhere',
  '&[data-qualified="true"]': { backgroundColor: theme.palette.scoreboard.qualified },
  '&[data-cut="true"]': { borderBottom: `4px solid ${theme.palette.primary.main}` },
  '& > * + *': { marginTop: theme.spacing(2) },
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

const Score = styled('dl')(({ theme }) => ({
  margin: 0,
  '& dt': { ...theme.typography.caption, color: theme.palette.text.secondary },
  '& dd': { ...theme.typography.data, margin: 0 },
}));

const Qualification = ({ qualified }: { qualified: boolean }) => (
  <Chip
    icon={qualified ? <CheckCircleOutlined /> : <Remove />}
    label={qualified ? 'Clasificado' : 'No clasificado'}
    size="small"
    variant="outlined"
  />
);

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
      <Cards aria-label={label}>
        {rows.map((row, index) => (
          <li key={row.teamId}>
            <MobileCard data-qualified={row.qualified} data-cut={cut === index + 1}>
              <Typography variant="data">Puesto #{row.place}</Typography>
              <TeamIdentity team={row.team} />
              <SchoolIdentity school={row.school} />
              <Score>
                <dt>Puntaje publicado</dt>
                <dd>{String(row.score)}</dd>
              </Score>
              <Qualification qualified={row.qualified} />
            </MobileCard>
            {cut === index + 1 && (
              <CutLabel variant="caption">Línea de corte de clasificación</CutLabel>
            )}
          </li>
        ))}
      </Cards>
    );
  }
  return (
    <>
      <ScrollRegion
        role="region"
        aria-label="Clasificación acumulada con desplazamiento"
        tabIndex={0}
      >
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
                  <Qualification qualified={row.qualified} />
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
