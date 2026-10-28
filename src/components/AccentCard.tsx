import { Card } from '@mui/material';
import { styled } from '@mui/material/styles';

/** A card marked with the brand accent along its top edge. */
export const AccentCard = styled(Card)(({ theme }) => ({
  minWidth: 0,
  overflowWrap: 'anywhere',
  borderTop: `4px solid ${theme.palette.brand.yellow}`,
}));

export const AccentCardContent = styled('div')(({ theme }) => ({
  padding: theme.spacing(2.5),
  [theme.breakpoints.up('md')]: { padding: theme.spacing(4) },
}));
