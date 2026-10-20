import {
  Alert,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';

import { ProblemResultCell } from './ProblemResultCell';
import { ProblemResults } from './ProblemResults';
import { SchoolIdentity } from './SchoolIdentity';
import { TeamIdentity } from './TeamIdentity';
import { selectContestRows } from '../model/selectors';

import type { Contest } from '../model/schemas';
import type { ScoreboardsArchive } from '../repositories/scoreboardsRepository';

// The colgroup and sticky offsets share exact, border-box widths.
const widths = { place: 72, team: 200, school: 240, problem: 100, summary: 120 };
const identityWidth = widths.place + widths.team + widths.school;

const ScrollRegion = styled('div')(({ theme }) => ({
  overflow: 'auto',
  maxHeight: '72dvh',
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  position: 'relative',
  '& [role="img"]': {
    scrollMarginLeft: identityWidth + 8,
    scrollMarginRight: theme.spacing(1),
    scrollMarginTop: theme.spacing(12),
    scrollMarginBottom: theme.spacing(1),
  },
}));

const StandingsTable = styled(Table, {
  shouldForwardProp: (prop) => prop !== 'problemCount',
})<{ problemCount: number }>(({ theme, problemCount }) => ({
  tableLayout: 'fixed',
  width: identityWidth + problemCount * widths.problem + 2 * widths.summary,
  borderCollapse: 'separate',
  borderSpacing: 0,
  '& th, & td': {
    boxSizing: 'border-box',
    padding: theme.spacing(1),
    overflowWrap: 'anywhere',
    backgroundColor: theme.palette.background.paper,
  },
  '& thead th': { position: 'sticky', top: 0, zIndex: 2 },
  '& tr > :nth-of-type(-n+3)': { position: 'sticky', zIndex: 1 },
  '& tr > :nth-of-type(1)': { left: 0 },
  '& tr > :nth-of-type(2)': { left: widths.place },
  '& tr > :nth-of-type(3)': {
    left: widths.place + widths.team,
    borderRight: `1px solid ${theme.palette.divider}`,
  },
  '& thead tr > :nth-of-type(-n+3)': { zIndex: 3 },
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
  '& > * + *': { marginTop: theme.spacing(2) },
}));
const Totals = styled('dl')(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(2),
  margin: 0,
  '& dd': { ...theme.typography.data, margin: 0 },
  '& dt': { ...theme.typography.caption, color: theme.palette.text.secondary },
}));

export const ContestStandings = ({
  archive,
  contest,
}: {
  archive: ScoreboardsArchive;
  contest: Contest;
}) => {
  const desktop = useMediaQuery(useTheme().breakpoints.up('md'));
  const rows = selectContestRows(archive, contest);
  if (rows.length === 0) {
    return <Alert severity="info">Este concurso todavía no tiene equipos publicados.</Alert>;
  }
  if (!desktop) {
    return (
      <>
        <Alert severity="info">
          La vista móvil agrupa los problemas por equipo y conserva todos los resultados.
        </Alert>
        <Cards aria-label={`Clasificación de ${contest.name}`}>
          {rows.map((row) => (
            <li key={row.teamId}>
              <MobileCard>
                <Typography variant="data">Puesto #{row.place}</Typography>
                <TeamIdentity team={row.team} />
                <SchoolIdentity school={row.school} />
                <Totals>
                  <div>
                    <dt>Resueltos</dt>
                    <dd>{row.solved}</dd>
                  </div>
                  <div>
                    <dt>Penalización</dt>
                    <dd>{row.penalty} min</dd>
                  </div>
                </Totals>
                <ProblemResults
                  problems={contest.problems}
                  results={row.results}
                  firstSolvedLabels={row.firstSolvedLabels}
                  teamName={row.team.name}
                />
              </MobileCard>
            </li>
          ))}
        </Cards>
      </>
    );
  }
  return (
    <ScrollRegion role="region" aria-label="Clasificación con desplazamiento" tabIndex={0}>
      <StandingsTable
        problemCount={contest.problems.length}
        aria-label={`Clasificación de ${contest.name}`}
      >
        <colgroup>
          <col width={widths.place} />
          <col width={widths.team} />
          <col width={widths.school} />
          {contest.problems.map(({ label }) => (
            <col key={label} width={widths.problem} />
          ))}
          <col width={widths.summary} />
          <col width={widths.summary} />
        </colgroup>
        <TableHead>
          <TableRow>
            <TableCell scope="col">Puesto</TableCell>
            <TableCell scope="col">Equipo</TableCell>
            <TableCell scope="col">Institución</TableCell>
            {contest.problems.map((problem) => (
              <TableCell key={problem.label} scope="col" align="center">
                Problema {problem.label}
                {problem.title !== undefined && (
                  <Typography component="div" variant="caption">
                    {problem.title}
                  </Typography>
                )}
              </TableCell>
            ))}
            <TableCell scope="col" align="right">
              Resueltos
            </TableCell>
            <TableCell scope="col" align="right">
              Penalización
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.teamId}>
              <TableCell>
                <Typography variant="data">#{row.place}</Typography>
              </TableCell>
              <TableCell component="th" scope="row">
                <TeamIdentity team={row.team} />
              </TableCell>
              <TableCell>
                <SchoolIdentity school={row.school} />
              </TableCell>
              {contest.problems.map((problem, index) => (
                <TableCell key={problem.label}>
                  <ProblemResultCell
                    problem={problem}
                    result={row.results[index]}
                    firstToSolve={row.firstSolvedLabels.includes(problem.label)}
                    teamName={row.team.name}
                  />
                </TableCell>
              ))}
              <TableCell align="right">
                <Typography variant="data">{row.solved}</Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="data">{row.penalty} min</Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </StandingsTable>
    </ScrollRegion>
  );
};
