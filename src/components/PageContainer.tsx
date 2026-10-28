import { Container } from '@mui/material';
import { styled } from '@mui/material/styles';

export const PageContainer = styled(Container)(({ theme }) => ({
  paddingBlock: theme.spacing(4),
  overflowWrap: 'anywhere',
  [theme.breakpoints.up('md')]: { paddingBlock: theme.spacing(6) },
}));
