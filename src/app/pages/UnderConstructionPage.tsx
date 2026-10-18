import ConstructionIcon from '@mui/icons-material/Construction';
import { Container, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

const PageRoot = styled('main')({
  alignItems: 'center',
  display: 'flex',
  minHeight: '100vh',
});

const CenteredStack = styled(Stack)({
  alignItems: 'center',
  textAlign: 'center',
});

const PageIcon = styled(ConstructionIcon)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(72),
}));

export const UnderConstructionPage = () => {
  return (
    <PageRoot>
      <Container maxWidth="sm">
        <CenteredStack spacing={3}>
          <PageIcon color="primary" />
          <Typography component="h1" variant="h2">
            Under construction
          </Typography>
          <Typography color="text.secondary" variant="body1">
            Huron Scoreboards is being built. Check back soon.
          </Typography>
        </CenteredStack>
      </Container>
    </PageRoot>
  );
};
