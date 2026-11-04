import Launch from '@mui/icons-material/Launch';
import { Alert, Button, Card, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { Link, useSearchParams } from 'react-router';

import { QualificationChip } from './QualificationChip';
import { SchoolHistoryResultControls } from './SchoolHistoryResultControls';
import { TeamIdentity } from './TeamIdentity';
import { selectSchoolAccumulatedResults } from '../model/schoolResultsFilters';

import type { SchoolHistory } from '../model/schoolHistory';

const Results = styled(Stack)(({ theme }) => ({ marginTop: theme.spacing(2) }));
const Result = styled(Card)(({ theme }) => ({
  padding: theme.spacing(2),
  overflowWrap: 'anywhere',
}));
const SummaryRow = styled(Stack)(({ theme }) => ({
  justifyContent: 'space-between',
  [theme.breakpoints.down('sm')]: { flexDirection: 'column', alignItems: 'flex-start' },
  [theme.breakpoints.up('sm')]: { flexDirection: 'row', alignItems: 'center' },
}));
const InlineSummary = styled(Stack)(({ theme }) => ({
  alignItems: 'center',
  flexDirection: 'row',
  gap: theme.spacing(1),
  flexWrap: 'wrap',
}));

export const SchoolAccumulatedResults = ({ history }: { history: SchoolHistory }) => {
  const [params] = useSearchParams();
  const seasons = [...new Set(history.accumulated.map(({ standing }) => standing.seasonYear))].sort(
    (a, b) => b - a,
  );
  const results = selectSchoolAccumulatedResults(history.accumulated, params);
  return (
    <section aria-labelledby="school-accumulated-heading">
      <Typography id="school-accumulated-heading" component="h2" variant="h4">
        Clasificaciones acumuladas publicadas
      </Typography>
      <Typography color="text.secondary">
        Se muestran por separado y no cuentan como concursos, resultados ni participación.
      </Typography>
      {history.accumulated.length === 0 ? (
        <Typography color="text.secondary">
          No hay clasificaciones acumuladas publicadas para la serie seleccionada.
        </Typography>
      ) : (
        <>
          <SchoolHistoryResultControls seasons={seasons} accumulated />
          {params.get('accumulatedSort') === 'score' && (
            <Alert severity="warning">
              Los puntajes publicados pueden usar unidades o escalas distintas entre temporadas.
            </Alert>
          )}
          <Typography role="status" aria-label="Recuento de acumulados" color="text.secondary">
            {results.length} de {history.accumulated.length} resultados acumulados
          </Typography>
          {results.length === 0 ? (
            <Typography color="text.secondary">
              No hay clasificaciones acumuladas que coincidan con estos filtros.
            </Typography>
          ) : (
            <Results spacing={2} role="list" aria-label="Resultados acumulados">
              {results.map(({ standing, row }) => (
                <Result
                  key={`${String(standing.seasonYear)}-${standing.seriesId}-${row.teamId}`}
                  variant="outlined"
                  role="listitem"
                >
                  <SummaryRow spacing={2}>
                    <div>
                      <Typography component="h3" variant="h6">
                        {standing.seasonYear} · {standing.seriesId} · puesto #{row.place}
                      </Typography>
                      <TeamIdentity team={row.team} />
                    </div>
                    <InlineSummary>
                      <Typography variant="data">
                        Puntaje publicado: {row.score}
                        {standing.scoreUnit === undefined ? '' : ` ${standing.scoreUnit}`}
                      </Typography>
                      <QualificationChip qualified={row.qualified} />
                      <Button
                        component={Link}
                        to={`/scoreboards?season=${String(standing.seasonYear)}&series=${encodeURIComponent(standing.seriesId)}&view=accumulated`}
                        endIcon={<Launch />}
                      >
                        Ver clasificación
                      </Button>
                    </InlineSummary>
                  </SummaryRow>
                </Result>
              ))}
            </Results>
          )}
        </>
      )}
    </section>
  );
};
