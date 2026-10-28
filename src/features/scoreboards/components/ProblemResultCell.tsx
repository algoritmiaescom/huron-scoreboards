import Bolt from '@mui/icons-material/Bolt';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Close from '@mui/icons-material/Close';
import Remove from '@mui/icons-material/Remove';
import { ClickAwayListener, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useState } from 'react';

import type { Problem, ProblemResult } from '../model/schemas';

type ResultAppearance = ProblemResult['status'] | 'firstSolve';

const Cell = styled('div', {
  shouldForwardProp: (prop) => prop !== 'appearance',
})<{ appearance: ResultAppearance }>(({ theme, appearance }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: theme.spacing(8.5),
  minHeight: theme.spacing(6),
  padding: theme.spacing(0.5),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.scoreboard[appearance],
  color:
    appearance === 'unattempted'
      ? theme.palette.text.secondary
      : theme.palette.scoreboard[`${appearance}Text`],
  border: `2px solid ${appearance === 'firstSolve' ? theme.palette.brand.yellow : 'transparent'}`,
  scrollMargin: theme.spacing(1),
}));

const ResultLine = styled('span')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(0.5),
  '& svg': { fontSize: theme.typography.pxToRem(16) },
}));

const FirstSolveLabel = styled('span')(({ theme }) => ({
  ...theme.typography.caption,
  fontWeight: theme.typography.fontWeightBold,
  letterSpacing: '0.08em',
}));

interface ProblemResultCellProps {
  problem: Problem;
  result: ProblemResult;
  firstToSolve?: boolean;
  teamName?: string;
}

export const ProblemResultCell = ({
  problem,
  result,
  firstToSolve = false,
  teamName,
}: ProblemResultCellProps) => {
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const first = result.status === 'solved' && firstToSolve;
  const problemName = `Problema ${problem.label}${problem.title ? `: ${problem.title}` : ''}`;
  const attempts =
    result.status === 'unattempted'
      ? ''
      : `${String(result.attempts)} ${result.attempts === 1 ? 'intento' : 'intentos'}`;
  const status =
    result.status === 'unattempted'
      ? 'Sin intentar'
      : result.status === 'attempted'
        ? `${attempts} ${result.attempts === 1 ? 'fallido' : 'fallidos'}, sin resolver`
        : `Resuelto en ${attempts} al minuto ${String(result.solvedAtMinute)}; los intentos incluyen el envío aceptado${first ? '; primero en resolver (posible empate)' : ''}`;
  const description = `${teamName ? `${teamName}. ` : ''}${problemName}. ${status}`;
  const icon =
    result.status === 'unattempted' ? (
      <Remove />
    ) : result.status === 'attempted' ? (
      <Close />
    ) : first ? (
      <Bolt />
    ) : (
      <CheckCircle />
    );

  return (
    <ClickAwayListener
      onClickAway={() => {
        setDescriptionOpen(false);
      }}
    >
      <Tooltip
        title={description}
        describeChild
        disableTouchListener
        open={descriptionOpen}
        onOpen={() => {
          setDescriptionOpen(true);
        }}
        onClose={() => {
          setDescriptionOpen(false);
        }}
      >
        <Cell
          role="img"
          tabIndex={0}
          aria-label={description}
          appearance={first ? 'firstSolve' : result.status}
          onClick={() => {
            setDescriptionOpen(true);
          }}
          onBlur={() => {
            setDescriptionOpen(false);
          }}
        >
          <ResultLine aria-hidden="true">
            {icon}
            {result.status !== 'unattempted' && (
              <Typography variant="data">
                {result.attempts}
                {result.status === 'solved' ? ` · ${String(result.solvedAtMinute)}` : ''}
              </Typography>
            )}
          </ResultLine>
          {first && <FirstSolveLabel aria-hidden="true">FTS</FirstSolveLabel>}
        </Cell>
      </Tooltip>
    </ClickAwayListener>
  );
};
