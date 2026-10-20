import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from '@/app/components/AppShell';
import { appConfig, repositoryLinks } from '@/app/config';
import { AppErrorPage, RouteErrorPage, RouteLoading } from '@/app/pages/RouteStatusPages';
import { routes } from '@/app/routes';
import { renderApp } from '@/test/test-utils';

afterEach(() => {
  vi.restoreAllMocks();
});

const renderRoute = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  renderApp(<RouterProvider router={router} />);
  return router;
};

describe('application routes', () => {
  it('removes provisional messaging when repository configuration is ready', async () => {
    const original = appConfig.repository.isPlaceholder;
    appConfig.repository.isPlaceholder = false;
    try {
      renderRoute('/contribute');
      expect(
        await screen.findByRole('link', { name: 'Abrir el repositorio de GitHub' }),
      ).toHaveAttribute('href', repositoryLinks.home);
      expect(screen.getByRole('link', { name: 'Repositorio en GitHub' })).toHaveAttribute(
        'href',
        repositoryLinks.home,
      );
      expect(screen.queryByText(/aún no está configurado/)).not.toBeInTheDocument();
    } finally {
      appConfig.repository.isPlaceholder = original;
    }
  });

  it('loads the complete contribution guide directly with model-correct guidance and configured links', async () => {
    renderRoute('/contribute');
    expect(
      await screen.findByRole('heading', {
        name: '¿Encontraste un error? Corrígelo desde la fuente.',
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(within(screen.getByRole('main')).getAllByRole('listitem').length).toBeGreaterThan(12);
    expect(screen.getByText('Los intentos incluyen el envío aceptado.')).toBeInTheDocument();
    expect(screen.getByText(/no siempre es 20/)).toBeInTheDocument();
    expect(screen.getByText(/No guardes primeros en resolver/)).toBeInTheDocument();
    expect(screen.getByText(/Nunca promociones/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Guía de contribución' })).toHaveAttribute(
      'href',
      repositoryLinks.contributing,
    );
    expect(screen.getByRole('link', { name: 'Modelo de datos' })).toHaveAttribute(
      'href',
      repositoryLinks.dataModel,
    );
    expect(screen.getByRole('link', { name: 'Explorar archivos JSON' })).toHaveAttribute(
      'href',
      repositoryLinks.data,
    );
    expect(screen.getByRole('link', { name: 'Pull requests' })).toHaveAttribute(
      'href',
      repositoryLinks.pullRequests,
    );
    expect(screen.getByText(/aún no está configurado/)).toBeInTheDocument();
    expect(appConfig.repository.isPlaceholder).toBe(true);
    await waitFor(() => {
      expect(document.title).toBe('Contribuir | Huron Scoreboards');
    });
  });

  it('recovers unknown paths and redirects through the real scoreboards route', async () => {
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const user = userEvent.setup();
    const router = renderRoute('/not-a-real-route');
    expect(
      await screen.findByRole('heading', { name: 'Página no encontrada' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Volver al inicio' }));
    expect(await screen.findByRole('heading', { name: /GPM|Final Regional/ })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/scoreboards');
    expect(screen.getByRole('main')).toHaveFocus();
    expect(scroll).toHaveBeenCalledWith(0, 0);
  });

  it('surfaces route exceptions with diagnostics and recovery actions', async () => {
    const error = new Error('test route failed');
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const router = createMemoryRouter([
      {
        Component: AppShell,
        children: [
          {
            index: true,
            loader: () => {
              throw error;
            },
            ErrorBoundary: RouteErrorPage,
          },
        ],
      },
    ]);
    renderApp(<RouterProvider router={router} />);
    expect(
      await screen.findByRole('heading', { name: 'No pudimos cargar esta página' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Ocurrió un error');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
    expect(log).toHaveBeenCalledWith('Could not render the requested page.', error);
  });

  it('presents an accessible initial loading state', () => {
    renderApp(<RouteLoading />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando página');
    expect(screen.getByRole('progressbar', { name: 'Cargando página' })).toBeInTheDocument();
  });

  it('preserves navigation and recovery when the root route fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const router = createMemoryRouter([
      {
        loader: () => {
          throw new Error('root route failed');
        },
        ErrorBoundary: AppErrorPage,
        path: '/',
      },
    ]);
    renderApp(<RouterProvider router={router} />);
    expect(
      await screen.findByRole('heading', { name: 'No pudimos cargar esta página' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
