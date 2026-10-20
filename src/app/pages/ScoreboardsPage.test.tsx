import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { flushSync } from 'react-dom';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { routes } from '@/app/routes';
import { archive, contest } from '@/test/fixtures/archive';
import { renderApp } from '@/test/test-utils';

import { ScoreboardsPage } from './ScoreboardsPage';

import type { ScoreboardsArchive } from '@/features/scoreboards';
import type { RepositoryResult } from '@/lib/data/repository';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const renderPage = (
  query = `contest=${contest.id}`,
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
              child.path === 'scoreboards'
                ? { ...child, Component: ScoreboardsPage, loader }
                : child,
            ),
          },
    ),
    { initialEntries: [`/scoreboards?${query}`] },
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

describe('contest filtering workflow', () => {
  it('combines filters, retains tied first solvers and official places, and removes one chip at a time', async () => {
    const user = userEvent.setup();
    const { router, loader } = renderPage();
    await screen.findByRole('heading', { name: 'Contest' });
    expect(document.title).toBe('Contest | Huron Scoreboards');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Problema' }), 'A');
    expect(screen.getByRole('status')).toHaveTextContent('4 de 4 equipos');
    await user.click(screen.getByRole('button', { name: 'Primero en resolver' }));
    expect(screen.getByRole('status')).toHaveTextContent('2 de 4 equipos');
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.queryByText('Gamma')).not.toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /primero en resolver/ })).toHaveLength(2);
    expect(screen.getByText('Puesto #2')).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Institución' }), 'campus');
    await user.click(screen.getByRole('button', { name: 'Resuelto' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre del equipo' }), 'BE');
    expect(screen.getByRole('status')).toHaveTextContent('1 de 4 equipos');
    expect(router.state.historyAction).toBe('REPLACE');
    expect(loader).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('textbox', { name: 'Nombre del equipo' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Quitar filtro Equipo: BE' }));
    expect(new URLSearchParams(router.state.location.search).has('team')).toBe(false);
    expect(new URLSearchParams(router.state.location.search).get('school')).toBe('campus');
    await user.click(screen.getByRole('button', { name: 'Limpiar todo' }));
    expect(router.state.location.search).toBe(`?contest=${contest.id}`);
    expect(screen.getByRole('status')).toHaveTextContent('4 de 4 equipos');
    expect(screen.queryByText('Vista filtrada')).not.toBeInTheDocument();
  }, 15000);

  it('does not manufacture first solves after filtering and offers empty-match recovery', async () => {
    const user = userEvent.setup();
    renderPage(`contest=${contest.id}&school=campus&problem=B&first=1`);
    expect(
      await screen.findByText('No hay equipos que coincidan con estos filtros.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByRole('status')).toHaveTextContent('4 de 4 equipos');
  });

  it('explains stale and malformed filters without showing unrelated rows', async () => {
    const user = userEvent.setup();
    const { router } = renderPage(`contest=${contest.id}&problem=Z&accepted=no&team=Alpha`);
    expect(
      await screen.findByText('El problema "Z" no pertenece a este concurso.'),
    ).toBeInTheDocument();
    expect(screen.getByText('El filtro "accepted" solo admite el valor "1".')).toBeInTheDocument();
    expect(
      screen.queryByRole('list', { name: 'Clasificación de Contest' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Quitar filtro problem' }));
    expect(new URLSearchParams(router.state.location.search).get('team')).toBe('Alpha');
    await user.click(screen.getByRole('button', { name: 'Quitar filtro accepted' }));
    expect(screen.getByRole('status')).toHaveTextContent('1 de 4 equipos');
  });

  it('clears filters on explicit contest changes, pushes history, and restores the previous view', async () => {
    const user = userEvent.setup();
    const other = {
      ...contest,
      id: '2024-gpm-q2',
      stage: 'qualifier-2' as const,
      name: 'Segundo concurso',
    };
    const { router } = renderPage(`contest=${contest.id}&team=Alpha&problem=A`, {
      status: 'ready',
      data: { ...archive, contests: [contest, other] },
    });
    await screen.findByRole('heading', { name: 'Contest' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Concurso' }), other.id);
    expect(router.state.location.search).toBe(`?contest=${other.id}`);
    expect(router.state.historyAction).toBe('PUSH');
    await act(async () => {
      await router.navigate(-1);
    });
    expect(screen.getByRole('textbox', { name: 'Nombre del equipo' })).toHaveValue('Alpha');
    expect(screen.getByRole('combobox', { name: 'Problema' })).toHaveValue('A');
    await act(async () => {
      await router.navigate(1);
    });
    expect(screen.getByRole('textbox', { name: 'Nombre del equipo' })).toHaveValue('');
  });

  it('canonicalizes default selection without dropping filters', async () => {
    const { router } = renderPage('team=Alpha');
    await screen.findByRole('heading', { name: 'Contest' });
    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('contest')).toBe(contest.id);
    });
    expect(new URLSearchParams(router.state.location.search).get('team')).toBe('Alpha');
  });
});

describe('standings state recovery', () => {
  it('distinguishes an empty archive and a contest without teams', async () => {
    const empty = { ...archive, schools: [], teams: [], contests: [], seasonStandings: [] };
    renderPage('', { status: 'empty', data: empty });
    expect(
      await screen.findByRole('heading', { name: 'Todavía no hay concursos publicados' }),
    ).toBeInTheDocument();
  });

  it('explains a contest with no teams', async () => {
    renderPage(`contest=${contest.id}`, {
      status: 'ready',
      data: { ...archive, contests: [{ ...contest, standings: [] }] },
    });
    expect(
      await screen.findByText('Este concurso todavía no tiene equipos publicados.'),
    ).toBeInTheDocument();
  });

  it.each(['invalid', 'error'] as const)(
    'shows repository %s diagnostics and retry',
    async (status) => {
      renderPage('', {
        status,
        issues: [{ file: 'data/example.json', location: '', message: 'Invalid archive' }],
      });
      expect(await screen.findByRole('heading', { name: 'No disponible' })).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar la clasificación');
      expect(screen.getByText('data/example.json: Invalid archive')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    },
  );

  it('recovers an invalid selection explicitly', async () => {
    const user = userEvent.setup();
    renderPage('contest=unknown');
    expect(await screen.findByRole('alert')).toHaveTextContent('No existe un concurso');
    await user.click(screen.getByRole('button', { name: 'Ver el último concurso' }));
    expect(await screen.findByRole('heading', { name: 'Contest' })).toBeInTheDocument();
  });

  it('handles an archive with only future contests honestly', async () => {
    renderPage('', {
      status: 'ready',
      data: { ...archive, contests: [{ ...contest, date: '2999-01-01' }] },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No hay concursos disponibles para la fecha actual',
    );
  });
});

describe('sharing standings', () => {
  it('does not claim success while clipboard writing is pending', async () => {
    const user = userEvent.setup();
    let finish: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    vi.spyOn(navigator.clipboard, 'writeText').mockReturnValue(pending);
    renderPage();
    const share = await screen.findByRole('button', { name: 'Compartir vista' });
    await user.click(share);
    expect(share).toBeDisabled();
    expect(screen.queryByText('Enlace copiado')).not.toBeInTheDocument();
    if (finish === undefined) {
      throw new Error('Expected a pending clipboard write.');
    }
    const complete = finish;
    await act(async () => {
      complete();
      await pending;
    });
    expect(screen.getByText('Enlace copiado')).toBeInTheDocument();
    expect(share).toBeEnabled();
  });
  it('announces success only after copying succeeds and clears stale feedback on edits', async () => {
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    renderPage(`contest=${contest.id}&team=Alpha`);
    await user.click(await screen.findByRole('button', { name: 'Compartir vista' }));
    expect(write).toHaveBeenCalledWith(window.location.href);
    expect(screen.getByText('Enlace copiado').closest('[role="status"]')).not.toBeNull();
    await user.type(screen.getByRole('textbox', { name: 'Nombre del equipo' }), 'x');
    expect(screen.queryByText('Enlace copiado')).not.toBeInTheDocument();
  });

  it.each(['missing', 'rejected'] as const)(
    'provides a selectable URL when clipboard is %s',
    async (failure) => {
      const user = userEvent.setup();
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      if (failure === 'missing') {
        vi.stubGlobal('navigator', Object.create(navigator, { clipboard: { value: undefined } }));
      } else {
        vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
          new Error('Permission denied'),
        );
      }
      renderPage();
      await user.click(await screen.findByRole('button', { name: 'Compartir vista' }));
      const dialog = await screen.findByRole('dialog', { name: 'Compartir clasificación' });
      expect(within(dialog).getByRole('textbox', { name: 'Enlace para compartir' })).toHaveValue(
        window.location.href,
      );
      expect(screen.queryByText('Enlace copiado')).not.toBeInTheDocument();
      if (failure === 'rejected') {
        expect(log).toHaveBeenCalledWith('Could not copy the scoreboard URL.', expect.any(Error));
      }
      await user.click(within(dialog).getByRole('button', { name: 'Cerrar' }));
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    },
  );
});
