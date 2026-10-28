import Bolt from '@mui/icons-material/Bolt';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Close from '@mui/icons-material/Close';
import Remove from '@mui/icons-material/Remove';
import { Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

const Legend = styled('aside')(({ theme }) => ({
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
}));

const Items = styled('ul')(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(2),
  listStyle: 'none',
  margin: theme.spacing(1, 0),
  padding: 0,
  '& li': { display: 'flex', alignItems: 'center', gap: theme.spacing(0.5) },
}));

export const ResultsLegend = () => (
  <Legend aria-label="Leyenda de resultados">
    <Typography component="h2" variant="subtitle2">
      Cómo leer los resultados
    </Typography>
    <Items>
      <li>
        <Remove fontSize="small" /> Sin intentar
      </li>
      <li>
        <Close fontSize="small" /> Intentos fallidos, sin resolver
      </li>
      <li>
        <CheckCircle fontSize="small" /> Resuelto: intentos · minuto
      </li>
      <li>
        <Bolt fontSize="small" /> FTS: primero en resolver (puede haber empates)
      </li>
    </Items>
    <Typography variant="body2" color="text.secondary">
      Los intentos incluyen el envío aceptado. Consulta cada resultado con el teclado, el puntero o
      al tocarlo para ver su descripción completa.
    </Typography>
  </Legend>
);
