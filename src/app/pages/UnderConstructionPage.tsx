import ConstructionIcon from '@mui/icons-material/Construction';
import { Container, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

const PageRoot = styled('section')({
  alignItems: 'center',
  display: 'flex',
  minHeight: '65dvh',
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
      <title>En construcción | Huron Scoreboards</title>
      <Container maxWidth="sm">
        <CenteredStack spacing={3}>
          <PageIcon color="primary" />
          <Typography component="h1" variant="h2">
            En construcción
          </Typography>
          <Typography color="text.secondary" variant="body1">
            Huron Scoreboards esta en construcción. Vuelve pronto :).
          </Typography>
        </CenteredStack>
      </Container>
    </PageRoot>
  );
};
