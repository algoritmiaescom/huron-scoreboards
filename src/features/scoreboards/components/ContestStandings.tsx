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

import { ProblemResultCell } from './ProblemResultCell';
import { ProblemResults } from './ProblemResults';
import { SchoolIdentity } from './SchoolIdentity';
import { StandingCard } from './StandingCard';
import { TeamIdentity } from './TeamIdentity';

import type { Contest } from '../model/schemas';
import type { selectContestRows } from '../model/selectors';

// The colgroup and sticky offsets share exact, border-box widths.
const widths = { place: 72, team: 200, school: 240, problem: 100, summary: 120 };
const identityWidth = widths.place + widths.team + widths.school;

const StandingsScrollRegion = styled(ScrollRegion)(({ theme }) => ({
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
  '& [data-identity-column]': { position: 'sticky', zIndex: 1 },
  '& [data-identity-column="place"]': { left: 0 },
  '& [data-identity-column="team"]': { left: widths.place },
  '& [data-identity-column="school"]': {
    left: widths.place + widths.team,
    borderRight: `1px solid ${theme.palette.divider}`,
  },
  '& thead [data-identity-column]': { zIndex: 3 },
}));

export const ContestStandings = ({
  rows,
  contest,
}: {
  rows: ReturnType<typeof selectContestRows>;
  contest: Contest;
}) => {
  const desktop = useMediaQuery(useTheme().breakpoints.up('md'));
  if (rows.length === 0) {
    return <Alert severity="info">Este concurso todavía no tiene equipos publicados.</Alert>;
  }
  if (!desktop) {
    return (
      <>
        <Alert severity="info">
          La vista móvil agrupa los problemas por equipo y conserva todos los resultados.
        </Alert>
        <ListGrid aria-label={`Clasificación de ${contest.name}`}>
          {rows.map((row) => (
            <li key={row.teamId}>
              <StandingCard row={row}>
                <DataList
                  items={[
                    { label: 'Resueltos', value: row.solved },
                    { label: 'Penalización', value: `${String(row.penalty)} min` },
                  ]}
                />
                <ProblemResults
                  problems={contest.problems}
                  results={row.results}
                  firstSolvedLabels={row.firstSolvedLabels}
                  teamName={row.team.name}
                />
              </StandingCard>
            </li>
          ))}
        </ListGrid>
      </>
    );
  }
  return (
    <StandingsScrollRegion label="Clasificación con desplazamiento">
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
            <TableCell scope="col" data-identity-column="place">
              Puesto
            </TableCell>
            <TableCell scope="col" data-identity-column="team">
              Equipo
            </TableCell>
            <TableCell scope="col" data-identity-column="school">
              Institución
            </TableCell>
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
              <TableCell data-identity-column="place">
                <Typography variant="data">#{row.place}</Typography>
              </TableCell>
              <TableCell component="th" scope="row" data-identity-column="team">
                <TeamIdentity team={row.team} />
              </TableCell>
              <TableCell data-identity-column="school">
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
    </StandingsScrollRegion>
  );
};
