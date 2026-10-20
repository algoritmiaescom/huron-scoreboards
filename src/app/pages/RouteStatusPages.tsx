import { Alert, Button, CircularProgress, Container, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useEffect } from 'react';
import { Link, useRouteError } from 'react-router';

import { AppShell } from '@/app/components/AppShell';

const StatusContainer = styled(Container)(({ theme }) => ({
  paddingBlock: theme.spacing(8),
  overflowWrap: 'anywhere',
}));

const LoadingStack = styled(Stack)({ alignItems: 'center' });
const ActionStack = styled(Stack)({ alignItems: 'flex-start' });

export const RouteLoading = () => (
  <StatusContainer maxWidth="md">
    <title>Cargando | Huron Scoreboards</title>
    <LoadingStack role="status" spacing={2}>
      <CircularProgress aria-label="Cargando página" />
      <Typography>Cargando página…</Typography>
    </LoadingStack>
  </StatusContainer>
);

export const NotFoundPage = () => (
  <StatusContainer maxWidth="md">
    <title>Página no encontrada | Huron Scoreboards</title>
    <ActionStack spacing={3}>
      <Typography variant="overline" color="primary">
        Error 404
      </Typography>
      <Typography component="h1" variant="h2">
        Página no encontrada
      </Typography>
      <Typography color="text.secondary">
        Esta dirección no está disponible. Puedes volver al inicio o consultar cómo contribuir.
      </Typography>
      <Button component={Link} to="/" variant="contained">
        Volver al inicio
      </Button>
      <Button component={Link} to="/contribute">
        Cómo contribuir
      </Button>
    </ActionStack>
  </StatusContainer>
);

export const RouteErrorPage = () => {
  const error: unknown = useRouteError();
  useEffect(() => {
    console.error('Could not render the requested page.', error);
  }, [error]);
  return (
    <StatusContainer maxWidth="md">
      <title>Error al cargar | Huron Scoreboards</title>
      <ActionStack spacing={3}>
        <Typography component="h1" variant="h2">
          No pudimos cargar esta página
        </Typography>
        <Alert severity="error">
          Ocurrió un error. Puedes recargar la página para intentarlo de nuevo.
        </Alert>
        <Button
          variant="contained"
          onClick={() => {
            window.location.reload();
          }}
        >
          Reintentar
        </Button>
        <Button component={Link} to="/">
          Volver al inicio
        </Button>
      </ActionStack>
    </StatusContainer>
  );
};

export const AppErrorPage = () => (
  <AppShell>
    <RouteErrorPage />
  </AppShell>
);
