import { Alert, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useEffect } from 'react';
import { Link, useRouteError } from 'react-router';

import { AppShell } from '@/app/components/AppShell';
import { DocumentTitle } from '@/app/components/DocumentTitle';
import { StatusContainer } from '@/app/components/StatusContainer';
import { StatusPage } from '@/app/components/StatusPage';
import { RetryButton } from '@/components';

const LoadingStack = styled(Stack)({ alignItems: 'center' });

export const RouteLoading = () => (
  <StatusContainer maxWidth="md">
    <DocumentTitle>Cargando</DocumentTitle>
    <LoadingStack role="status" spacing={2}>
      <CircularProgress aria-label="Cargando página" />
      <Typography>Cargando página…</Typography>
    </LoadingStack>
  </StatusContainer>
);

export const NotFoundPage = () => (
  <StatusPage documentTitle="Página no encontrada" eyebrow="Error 404" title="Página no encontrada">
    <Typography color="text.secondary">
      Esta dirección no está disponible. Puedes volver al inicio o consultar cómo contribuir.
    </Typography>
    <Button component={Link} to="/" variant="contained">
      Volver al inicio
    </Button>
    <Button component={Link} to="/contribute">
      Cómo contribuir
    </Button>
  </StatusPage>
);

export const RouteErrorPage = () => {
  const error: unknown = useRouteError();
  useEffect(() => {
    console.error('Could not render the requested page.', error);
  }, [error]);
  return (
    <StatusPage documentTitle="Error al cargar" title="No pudimos cargar esta página">
      <Alert severity="error">
        Ocurrió un error. Puedes recargar la página para intentarlo de nuevo.
      </Alert>
      <RetryButton />
      <Button component={Link} to="/">
        Volver al inicio
      </Button>
    </StatusPage>
  );
};

export const AppErrorPage = () => (
  <AppShell>
    <RouteErrorPage />
  </AppShell>
);
