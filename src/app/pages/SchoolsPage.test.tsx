import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { flushSync } from 'react-dom';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { routes } from '@/app/routes';
import { archive } from '@/test/fixtures/archive';
import { renderApp } from '@/test/test-utils';

import { SchoolsPage } from './SchoolsPage';

import type { ScoreboardsArchive } from '@/features/scoreboards';
import type { RepositoryResult } from '@/lib/data/repository';

const renderPage = (
  query = '',
  result: RepositoryResult<ScoreboardsArchive> = { status: 'ready', data: archive },
) => {
  const loader = vi.fn(() => result);
  const router = createMemoryRouter(
    routes.map((route) =>
      route.index
        ? route
        : {
            ...route,
            children: route.children?.map((child) =>
              child.path === 'schools' ? { ...child, Component: SchoolsPage, loader } : child,
            ),
          },
    ),
    { initialEntries: [`/schools${query}`] },
  );
  renderApp(
    <RouterProvider
      router={router}
      flushSync={(callback) => {
        flushSync(callback);
      }}
    />,
  );
  return { router, loader };
};

describe('school index workflow', () => {
  it('shows precise scoped summaries, identities and working history links', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Instituciones a través de cada temporada.' });
    expect(document.title).toBe('Instituciones | Huron Scoreboards');
    expect(screen.getByRole('status')).toHaveTextContent('5 de 5 instituciones y unidades');
    const parent = screen.getByRole('article', { name: 'UNI' });
    expect(within(parent).getByRole('heading', { name: 'UNI' })).toBeInTheDocument();
    expect(within(parent).getByText('2 unidades académicas')).toBeInTheDocument();
    expect(within(parent).getByText('3', { exact: true })).toBeInTheDocument();
    expect(within(parent).getByText('1 concurso publicado')).toBeInTheDocument();
    expect(within(parent).getByText('#1')).toBeInTheDocument();
    const unit = screen.getByRole('article', { name: 'UNIT' });
    expect(within(unit).getByText('Unidad académica')).toBeInTheDocument();
    expect(within(unit).getByText(/sin agregar otras unidades/)).toBeInTheDocument();
    const unused = screen.getByRole('article', { name: 'N' });
    expect(within(unused).getByText('Sin resultados')).toBeInTheDocument();
    expect(within(unused).getByText('0', { exact: true })).toBeInTheDocument();
    expect(screen.getByText(/estadísticas provienen de resultados inventados/)).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Instituciones y unidades' })).getByRole('link', {
        name: 'UNI',
      }),
    ).toHaveAttribute('href', '/schools/uni');
    expect(
      within(screen.getByRole('list', { name: 'Instituciones y unidades' })).getAllByRole('link'),
    ).toHaveLength(5);
    expect(screen.queryByText(/undefined|null/)).not.toBeInTheDocument();
  });

  it('keeps rapid search edits in the URL without reloading and restores history', async () => {
    const user = userEvent.setup();
    const { router, loader } = renderPage('?q=Standalone');
    const input = await screen.findByRole('textbox', {
      name: 'Buscar instituciones, unidades, ciudades o estados',
    });
    expect(screen.getByRole('status')).toHaveTextContent('1 de 5');
    await user.clear(input);
    await user.type(input, 'Campus');
    expect(router.state.location.search).toBe('?q=Campus');
    expect(router.state.historyAction).toBe('REPLACE');
    expect(loader).toHaveBeenCalledTimes(1);
    expect(input).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('1 de 5');
    await act(async () => {
      await router.navigate('/schools?q=Standalone', { flushSync: true });
    });
    expect(input).toHaveValue('Standalone');
    await act(async () => {
      await router.navigate(-1);
    });
    expect(input).toHaveValue('Campus');
    await user.clear(input);
    expect(router.state.location.search).toBe('');
    expect(screen.getByRole('status')).toHaveTextContent('5 de 5');
  });

  it('distinguishes no matches from an empty school archive and clears search', async () => {
    const user = userEvent.setup();
    const { router } = renderPage('?q=nonexistent');
    expect(
      await screen.findByText('No hay instituciones que coincidan con esta búsqueda.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    expect(router.state.location.search).toBe('');
    expect(screen.getAllByRole('article')).toHaveLength(5);
  });

  it.each(['?q=UNI&q=Campus', '?unknown=1'])(
    'explains malformed search and offers recovery: %s',
    async (query) => {
      const user = userEvent.setup();
      const { router } = renderPage(query);
      expect(
        await screen.findByText('La búsqueda contiene parámetros repetidos o desconocidos.'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('article')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Restablecer búsqueda' }));
      expect(router.state.location.search).toBe('');
      expect(screen.getAllByRole('article')).toHaveLength(5);
    },
  );

  it('shows the honest empty archive without search or invented data', async () => {
    renderPage('', {
      status: 'empty',
      data: { source: 'archive', schools: [], teams: [], contests: [], seasonStandings: [] },
    });
    expect(
      await screen.findByText('Todavía no hay instituciones publicadas en este archivo.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.queryByText(/inventados/)).not.toBeInTheDocument();
  });

  it('shows schools even without any contest or accumulated results', async () => {
    renderPage('', {
      status: 'ready',
      data: { ...archive, source: 'archive', contests: [], seasonStandings: [] },
    });
    expect(await screen.findAllByRole('article')).toHaveLength(5);
    expect(screen.getAllByText('Sin resultados')).toHaveLength(5);
    expect(screen.queryByText(/inventados/)).not.toBeInTheDocument();
  });

  it.each(['error', 'invalid'] as const)(
    'surfaces %s repository diagnostics without partial summaries',
    async (status) => {
      renderPage('', {
        status,
        issues: [{ file: 'schools.json', location: '[0]', message: 'Invalid school' }],
      });
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No pudimos cargar las instituciones',
      );
      expect(screen.getByText('schools.json [0]: Invalid school')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
      expect(screen.queryByRole('article')).not.toBeInTheDocument();
    },
  );
});
