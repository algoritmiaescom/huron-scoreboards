import { Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

import { ProblemResultCell } from './ProblemResultCell';

import type { Problem, StandingRow } from '../model/schemas';

const Results = styled('ol')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: theme.spacing(1.5),
  listStyle: 'none',
  padding: 0,
  margin: 0,
  '& li': { minWidth: 0 },
}));

const ProblemLabel = styled(Typography)(({ theme }) => ({
  display: 'block',
  marginBottom: theme.spacing(0.5),
  overflowWrap: 'anywhere',
}));

export const ProblemResults = ({
  problems,
  results,
  firstSolvedLabels,
  teamName,
}: {
  problems: readonly Problem[];
  results: StandingRow['results'];
  firstSolvedLabels: readonly string[];
  teamName: string;
}) => {
  if (problems.length !== results.length) {
    throw new Error('ProblemResults requires one result per problem in contest order.');
  }
  return (
    <Results aria-label={`Resultados por problema de ${teamName}`}>
      {problems.map((problem, index) => (
        <li key={problem.label}>
          <ProblemLabel variant="caption">Problema {problem.label}</ProblemLabel>
          <ProblemResultCell
            problem={problem}
            result={results[index]}
            firstToSolve={firstSolvedLabels.includes(problem.label)}
            teamName={teamName}
          />
        </li>
      ))}
    </Results>
  );
};
