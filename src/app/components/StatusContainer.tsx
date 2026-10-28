import { Container } from '@mui/material';
import { styled } from '@mui/material/styles';

export const StatusContainer = styled(Container)(({ theme }) => ({
  paddingBlock: theme.spacing(8),
  overflowWrap: 'anywhere',
}));
