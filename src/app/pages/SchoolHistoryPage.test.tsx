import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { routes } from '@/app/routes';
import { archive, contest } from '@/test/fixtures/archive';
import { renderApp } from '@/test/test-utils';

import { SchoolHistoryPage } from './SchoolHistoryPage';

import type { ScoreboardsArchive } from '@/features/scoreboards';
import type { RepositoryResult } from '@/lib/data/repository';

const statistic = (label: string) => {
  const value = within(screen.getByRole('region', { name: 'Resumen del historial' }))
    .getByText(label)
    .parentElement?.querySelector('dd');
  if (value === null || value === undefined) {
    throw new Error(`Missing statistic value for ${label}`);
  }
  return value;
};

// The banner's best place precedes the per-season values in the trend chart.
const bestPlace = () => {
  const value = screen.getAllByText('Mejor puesto')[0]?.parentElement?.querySelector('dd');
  if (value === null || value === undefined) {
    throw new Error('Missing best place value');
  }
  return value;
};

const renderHistory = (
  path: string,
  data: RepositoryResult<ScoreboardsArchive> = { status: 'ready', data: archive },
) => {
  const loader = vi.fn(() => data);
  const router = createMemoryRouter(
    routes.map((route) =>
      route.index
        ? route
        : {
            ...route,
            children: route.children?.map((child) =>
              child.path === 'schools/:schoolId'
                ? { ...child, Component: SchoolHistoryPage, loader }
                : child,
            ),
          },
    ),
    { initialEntries: [path] },
  );
  renderApp(<RouterProvider router={router} />);
  return { router, loader };
};

describe('school history workflow', () => {
  it('shows an exact unit history, published contest details, rosters and direct links', async () => {
    const data = {
      ...archive,
      teams: archive.teams.map((team) =>
        team.id === '2024-a'
          ? { ...team, members: [{ name: 'Ana Example', role: 'contestant' as const }] }
          : team,
      ),
    };
    renderHistory('/schools/unit', { status: 'ready', data });
    await screen.findByRole('heading', { level: 1, name: 'Unit' });
    expect(document.title).toBe('UNIT | Instituciones | Huron Scoreboards');
    expect(screen.getByText('Esta escuela únicamente')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver institución UNI' })).toHaveAttribute(
      'href',
      '/schools/uni',
    );
    expect(statistic('Resultados de equipos')).toHaveTextContent('2');
    expect(statistic('Concursos')).toHaveTextContent('1');
    expect(statistic('Podios')).toHaveTextContent('1');
    expect(bestPlace()).toHaveTextContent('#1');
    expect(
      screen.getByRole('img', { name: /Tendencia del mejor puesto por temporada/ }),
    ).toHaveAttribute('aria-labelledby', 'school-trend-title school-trend-description');
    expect(screen.getByText(/Solo hay datos de una temporada/)).toBeInTheDocument();
    expect(
      screen.getByText(/Cada participación cuenta una fila de un equipo en un concurso/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Participación y problemas resueltos' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: 'Problemas resueltos en la temporada 2024' }),
    ).toHaveAttribute('aria-valuenow', '1');
    const result = screen.getByRole('list', { name: 'Resultados de concursos' });
    expect(within(result).getAllByRole('link', { name: 'Contest' })).toHaveLength(2);
    within(result)
      .getAllByRole('link', { name: 'Contest' })
      .forEach((link) => {
        expect(link).toHaveAttribute('href', `/scoreboards?contest=${contest.id}`);
      });
    expect(result.querySelectorAll(':scope > li')).toHaveLength(2);
    expect(within(result).getByText('Alpha')).toBeInTheDocument();
    await userEvent.click(within(result).getByText('Integrantes de Alpha'));
    expect(within(result).getByText(/Ana Example/)).toBeVisible();
    expect(screen.getAllByRole('link', { name: 'Ver concurso completo' })).toHaveLength(2);
    screen.getAllByRole('link', { name: 'Ver concurso completo' }).forEach((link) => {
      expect(link).toHaveAttribute('href', `/scoreboards?contest=${contest.id}`);
    });
    expect(screen.getByRole('link', { name: 'Todas las instituciones' })).toHaveAttribute(
      'href',
      '/schools',
    );
  });

  it('aggregates an institution and exposes each descendant scope without duplicating contest results', async () => {
    const user = userEvent.setup();
    const { router } = renderHistory('/schools/uni');
    await screen.findByRole('heading', { level: 1, name: 'University' });
    expect(screen.getByText('Alcance institucional')).toBeInTheDocument();
    expect(screen.getByText(/Resultados directos de UNI y de sus unidades/)).toBeInTheDocument();
    expect(statistic('Resultados de equipos')).toHaveTextContent('3');
    expect(statistic('Equipos')).toHaveTextContent('3');
    expect(statistic('Podios')).toHaveTextContent('2');
    expect(screen.getAllByRole('link', { name: 'Ver concurso completo' })).toHaveLength(3);
    await user.click(screen.getByRole('link', { name: 'Ver solo resultados directos' }));
    expect(router.state.location.search).toBe('?scope=school');
    expect(statistic('Resultados de equipos')).toHaveTextContent('0');
    expect(
      screen.getByText('Esta escuela todavía no tiene resultados de concursos publicados.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Incluir unidades descendientes' }));
    expect(router.state.location.search).toBe('?scope=institution');
    expect(statistic('Resultados de equipos')).toHaveTextContent('3');
  });

  it('keeps accumulated rows separate from contest statistics and trend lines', async () => {
    renderHistory('/schools/unit', {
      status: 'ready',
      data: { ...archive, contests: [], seasonStandings: [archive.seasonStandings[0]] },
    });
    await screen.findByRole('heading', { level: 1, name: 'Unit' });
    expect(statistic('Resultados de equipos')).toHaveTextContent('0');
    expect(statistic('Podios')).toHaveTextContent('0');
    expect(
      screen.queryByRole('img', { name: /Tendencia del mejor puesto por temporada/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'Todavía no hay resultados de concursos publicados para construir una tendencia.',
      ),
    ).toBeInTheDocument();
    const accumulated = screen.getByRole('heading', {
      name: 'Clasificaciones acumuladas publicadas',
    }).parentElement;
    if (accumulated === null) {
      throw new Error('Missing accumulated-history section');
    }
    expect(within(accumulated).getByText('Puntaje publicado: 12.75')).toBeInTheDocument();
    expect(within(accumulated).getAllByRole('link', { name: 'Ver clasificación' })).toHaveLength(2);
    within(accumulated)
      .getAllByRole('link', { name: 'Ver clasificación' })
      .forEach((link) => {
        expect(link).toHaveAttribute(
          'href',
          '/scoreboards?season=2024&series=gpm&view=accumulated',
        );
      });
  });

  it('handles unknown school ids, invalid scope parameters and zero-result schools explicitly', async () => {
    const user = userEvent.setup();
    const { router } = renderHistory('/schools/missing');
    expect(
      await screen.findByRole('heading', { name: 'Institución no encontrada' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Volver a instituciones' }));
    expect(
      await screen.findByRole('heading', { name: 'Instituciones a través de cada temporada.' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/schools');
  });

  it('keeps zero-result schools discoverable without manufacturing a trend or placement', async () => {
    renderHistory('/schools/unused');
    await screen.findByRole('heading', { level: 1, name: 'No registrations' });
    expect(bestPlace()).toHaveTextContent('—');
    expect(
      screen.getByText('Esta escuela todavía no tiene resultados de concursos publicados.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: /Tendencia del mejor puesto/ }),
    ).not.toBeInTheDocument();
  });

  it.each([
    '/schools/uni?scope=unknown',
    '/schools/uni?scope=school&scope=institution',
    '/schools/uni?q=x',
  ])('recovers malformed history scope: %s', async (path) => {
    const user = userEvent.setup();
    const { router } = renderHistory(path);
    expect(await screen.findByRole('alert')).toHaveTextContent('El alcance debe ser único');
    await user.click(screen.getByRole('link', { name: 'Restablecer alcance' }));
    expect(router.state.location.search).toBe('');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'University' }),
    ).toBeInTheDocument();
  });

  it('orders multi-season trend points by season and reverses the rank axis', async () => {
    const priorTeam = { ...archive.teams[0], id: '2023-alpha', seasonYear: 2023 };
    const priorContest = {
      ...contest,
      id: '2023-gpm-q1',
      seasonYear: 2023,
      date: '2023-03-01',
      standings: [{ ...contest.standings[0], teamId: priorTeam.id, place: 12 }],
    };
    renderHistory('/schools/unit', {
      status: 'ready',
      data: { ...archive, teams: [...archive.teams, priorTeam], contests: [contest, priorContest] },
    });
    await screen.findByRole('heading', { level: 1, name: 'Unit' });
    const chart = screen.getByRole('img', { name: /Tendencia del mejor puesto por temporada/ });
    const points = chart.querySelectorAll('[data-season]');
    expect(points).toHaveLength(2);
    expect(points[0]).toHaveAttribute('data-season', '2023');
    expect(points[0]).toHaveAttribute('data-place', '12');
    expect(points[1]).toHaveAttribute('data-season', '2024');
    expect(points[1]).toHaveAttribute('data-place', '1');
    expect([...chart.querySelectorAll('.rank-label')].map((label) => label.textContent)).toEqual([
      '1',
      '3',
      '5',
      '7',
      '9',
      '11',
      '12',
    ]);
    expect(screen.getAllByText('2023').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2024').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Solo hay datos de una temporada/)).not.toBeInTheDocument();
  });

  it('has a valid state when repository data is empty', async () => {
    renderHistory('/schools/uni', {
      status: 'empty',
      data: { source: 'archive', schools: [], teams: [], contests: [], seasonStandings: [] },
    });
    expect(
      await screen.findByRole('heading', { name: 'Institución no encontrada' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: 'Tendencia del mejor puesto por temporada' }),
    ).not.toBeInTheDocument();
  });
});
