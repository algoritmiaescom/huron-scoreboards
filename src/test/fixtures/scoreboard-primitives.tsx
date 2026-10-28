import {
  Card,
  Container,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';

import { ThemeModeControl } from '@/app/components/ThemeModeControl';
import { AppProviders } from '@/app/providers/AppProviders';
import {
  ContestHeader,
  ProblemResultCell,
  ProblemResults,
  ResultsLegend,
  SchoolIdentity,
  selectContestRows,
  TeamIdentity,
} from '@/features/scoreboards';
import { AccumulatedStandings } from '@/features/scoreboards/components/AccumulatedStandings';
import { ContestResults } from '@/features/scoreboards/components/ContestResults';

import { archive, contest, partialContest, partialStanding } from './archive';

const Page = styled(Container)(({ theme }) => ({
  paddingBlock: theme.spacing(3),
  '& > *': { marginBottom: theme.spacing(3) },
}));

const ScrollRegion = styled('div')(({ theme }) => ({
  overflowX: 'auto',
  maxWidth: '100%',
  padding: theme.spacing(1),
}));

const MobileCards = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: theme.spacing(2),
  [theme.breakpoints.up('md')]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
}));

const CardBody = styled(Card)(({ theme }) => ({
  padding: theme.spacing(2),
  minWidth: 0,
}));

const stressContest = {
  ...contest,
  name: 'Concurso de demostración con un nombre extraordinariamente largo y metadatos completos',
  problems: [{ label: 'B', title: 'Problema con título largo' }, { label: 'A' }, { label: 'C' }],
  standings: contest.standings.map((row) => {
    if (row.results === null) {
      throw new Error('The stress fixture requires detailed problem results.');
    }
    return { ...row, results: [row.results[1], row.results[0], row.results[2]] };
  }),
};

export const Fixture = () => {
  const rows = selectContestRows(archive, stressContest);
  if (new URLSearchParams(window.location.search).has('partial')) {
    return (
      <Page maxWidth="lg">
        <ThemeModeControl />
        <main>
          <Stack spacing={3}>
            <ContestHeader contest={partialContest} datasetSource="mock" />
            <ContestResults archive={archive} contest={partialContest} />
            <Typography component="h2" variant="h4">
              Clasificación acumulada
            </Typography>
            <AccumulatedStandings archive={archive} standing={partialStanding} />
          </Stack>
        </main>
      </Page>
    );
  }
  return (
    <Page maxWidth="lg">
      <ThemeModeControl />
      <main>
        <Stack spacing={3}>
          <ContestHeader contest={stressContest} datasetSource="mock" />
          <ResultsLegend />
          <Typography component="h2" variant="h4">
            Resultados en tabla
          </Typography>
          <ScrollRegion
            role="region"
            aria-label="Tabla de prueba con desplazamiento horizontal"
            tabIndex={0}
          >
            <Table aria-label="Resultados de prueba">
              <TableHead>
                <TableRow>
                  <TableCell>Equipo</TableCell>
                  {stressContest.problems.map(({ label }) => (
                    <TableCell key={label}>Problema {label}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.teamId}>
                    <TableCell>
                      <TeamIdentity team={row.team} />
                    </TableCell>
                    {stressContest.problems.map((problem, index) => (
                      <TableCell key={problem.label}>
                        <ProblemResultCell
                          problem={problem}
                          result={row.results?.[index] ?? null}
                          firstToSolve={row.firstSolvedLabels.includes(problem.label)}
                          teamName={row.team.name}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollRegion>
          <Typography component="h2" variant="h4">
            Resultados en tarjetas
          </Typography>
          <MobileCards aria-label="Tarjetas de prueba">
            {rows.map((row) => (
              <CardBody key={row.teamId}>
                <Stack spacing={2}>
                  <TeamIdentity team={row.team} />
                  <SchoolIdentity school={row.school} />
                  <ProblemResults
                    teamName={row.team.name}
                    problems={stressContest.problems}
                    results={row.results}
                    firstSolvedLabels={row.firstSolvedLabels}
                  />
                </Stack>
              </CardBody>
            ))}
          </MobileCards>
          <CardBody>
            <TeamIdentity
              team={{
                ...archive.teams[0],
                name: 'EquipoConUnNombreExtraordinariamenteLargoSinEspaciosParaComprobarElReflujo',
                members: [
                  { name: 'Ana', role: 'contestant' },
                  { name: 'Bruno', role: 'coach' },
                  { name: 'Carmen' },
                ],
              }}
            />
            <SchoolIdentity
              school={{
                ...archive.schools[0],
                officialName:
                  'InstituciónConNombreExtraordinariamenteLargoSinEspaciosParaComprobarElReflujo',
                city: 'Ciudad de México',
              }}
            />
          </CardBody>
        </Stack>
      </main>
    </Page>
  );
};

const root = document.getElementById('root');
if (root === null) {
  throw new Error('Fixture root element not found.');
}
createRoot(root).render(
  <AppProviders>
    <MemoryRouter>
      <Fixture />
    </MemoryRouter>
  </AppProviders>,
);
