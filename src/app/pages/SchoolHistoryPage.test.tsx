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
                : child.path === 'schools'
                  ? { ...child, loader }
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
  it('defaults to seasons and uses the standings series labels', async () => {
    const user = userEvent.setup();
    const { router } = renderHistory('/schools/unit');
    await screen.findByRole('heading', { level: 1, name: 'Unit' });
    expect(screen.getByRole('tab', { name: 'Temporadas y podios' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tabpanel', { name: 'Temporadas y podios' })).toBeVisible();
    expect(
      screen.getByRole('option', { name: 'Gran Premio de México · Clasificatorias' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Gran Premio de México · Clasificación acumulada' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Final Regional Mexicana' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Resultados por concursos' }));
    expect(router.state.location.search).toBe('?tab=contests');
    await user.click(screen.getByRole('tab', { name: 'Temporadas y podios' }));
    expect(router.state.location.search).toBe('');
  });

  it('applies the global series to summary, trends, podiums and all tab panels', async () => {
    const user = userEvent.setup();
    const { router } = renderHistory('/schools/unit?tab=contests', {
      status: 'ready',
      data: {
        ...archive,
        contests: [
          contest,
          {
            ...contest,
            id: '2024-finals',
            seriesId: 'mexico-finals',
            stage: 'final',
            standings: contest.standings.map((row) => ({ ...row, place: 4 })),
          },
        ],
      },
    });
    await screen.findByRole('heading', { level: 1, name: 'Unit' });
    const series = screen.getByRole('combobox', { name: 'Serie del historial' });
    await user.selectOptions(series, 'mexico-finals');
    expect(statistic('Resultados de equipos')).toHaveTextContent('2');
    expect(statistic('Concursos')).toHaveTextContent('1');
    expect(statistic('Podios')).toHaveTextContent('0');
    expect(bestPlace()).toHaveTextContent('#4');
    expect(document.querySelector('[data-season="2024"]')).toHaveAttribute('data-place', '4');
    expect(
      screen.getByRole('list', { name: 'Resultados de concursos' }).querySelectorAll(':scope > li'),
    ).toHaveLength(2);
    await user.click(screen.getByRole('tab', { name: 'Clasificaciones acumuladas' }));
    expect(
      screen.getByText('No hay clasificaciones acumuladas publicadas para la serie seleccionada.'),
    ).toBeVisible();
    await user.selectOptions(series, 'gpm-accumulated');
    expect(statistic('Resultados de equipos')).toHaveTextContent('0');
    expect(statistic('Podios')).toHaveTextContent('1');
    expect(bestPlace()).toHaveTextContent('#1');
    expect(screen.getByRole('list', { name: 'Resultados acumulados' })).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Participación y problemas resueltos' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Temporadas y podios' }));
    expect(screen.getByRole('tabpanel', { name: 'Temporadas y podios' })).toHaveTextContent(
      '1 podios',
    );
    await user.selectOptions(series, 'gpm-qualifiers');
    expect(statistic('Resultados de equipos')).toHaveTextContent('2');
    expect(statistic('Podios')).toHaveTextContent('1');
    expect(new URLSearchParams(router.state.location.search).get('series')).toBe('gpm-qualifiers');
    await user.selectOptions(series, 'all');
    expect(new URLSearchParams(router.state.location.search).has('series')).toBe(false);
    expect(statistic('Resultados de equipos')).toHaveTextContent('4');
    expect(screen.getByRole('tab', { name: 'Temporadas y podios' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('restores tab and global series from the URL and supports keyboard tab navigation', async () => {
    const user = userEvent.setup();
    const { router } = renderHistory('/schools/unit?series=gpm-accumulated&tab=accumulated');
    await screen.findByRole('heading', { level: 1, name: 'Unit' });
    expect(screen.getByRole('combobox', { name: 'Serie del historial' })).toHaveValue(
      'gpm-accumulated',
    );
    expect(screen.getByRole('tabpanel', { name: 'Clasificaciones acumuladas' })).toBeVisible();
    const tab = screen.getByRole('tab', { name: 'Clasificaciones acumuladas' });
    tab.focus();
    await user.keyboard('{ArrowRight}{Enter}');
    expect(screen.getByRole('tab', { name: 'Resultados por concursos' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(router.state.location.search).toBe('?series=gpm-accumulated&tab=contests');
    expect(
      screen.getByText('Esta escuela todavía no tiene resultados de concursos publicados.'),
    ).toBeVisible();
  });

  it('expands all podiums in ranked order and collapses back to five without changing filters', async () => {
    const user = userEvent.setup();
    const { router } = renderHistory('/schools/unit?team=Alpha', {
      status: 'ready',
      data: {
        ...archive,
        seasonStandings: [],
        contests: Array.from({ length: 6 }, (_, index) => ({
          ...contest,
          id: `2024-podium-${String(index)}`,
          name: `Podium ${String(index)}`,
          date: `2024-03-0${String(index + 1)}`,
        })),
      },
    });
    await screen.findByRole('heading', { level: 1, name: 'Unit' });
    const podiums = screen.getByRole('list', { name: 'Podios destacados' });
    expect(within(podiums).getAllByRole('listitem')).toHaveLength(5);
    expect(within(podiums).queryByText('Podium 0')).not.toBeInTheDocument();
    const expand = screen.getByRole('button', { name: 'Ver todos' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    await user.click(expand);
    expect(within(podiums).getAllByRole('listitem')).toHaveLength(6);
    expect(
      within(podiums)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Podium 5', 'Podium 4', 'Podium 3', 'Podium 2', 'Podium 1', 'Podium 0']);
    expect(router.state.location.search).toBe('?team=Alpha');
    const collapse = screen.getByRole('button', { name: 'Ver menos' });
    expect(collapse).toHaveAttribute('aria-expanded', 'true');
    await user.click(collapse);
    expect(within(podiums).getAllByRole('listitem')).toHaveLength(5);
    await user.click(screen.getByRole('button', { name: 'Ver todos' }));
    await user.click(screen.getByRole('link', { name: 'Ver institución UNI' }));
    expect(await screen.findByRole('button', { name: 'Ver todos' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('shows an exact unit history, published contest details, rosters and direct links', async () => {
    const data = {
      ...archive,
      teams: archive.teams.map((team) =>
        team.id === '2024-a'
          ? { ...team, members: [{ name: 'Ana Example', role: 'contestant' as const }] }
          : team,
      ),
    };
    renderHistory('/schools/unit?tab=contests', { status: 'ready', data });
    await screen.findByRole('heading', { level: 1, name: 'Unit' });
    expect(document.title).toBe('UNIT | Instituciones | Huron Scoreboards');
    expect(screen.getByText('Esta escuela únicamente')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver institución UNI' })).toHaveAttribute(
      'href',
      '/schools/uni',
    );
    expect(statistic('Resultados de equipos')).toHaveTextContent('2');
    expect(statistic('Concursos')).toHaveTextContent('1');
    expect(statistic('Podios')).toHaveTextContent('2');
    expect(screen.queryByRole('button', { name: 'Ver todos' })).not.toBeInTheDocument();
    expect(bestPlace()).toHaveTextContent('#1');
    expect(
      screen.getByRole('img', { name: /Tendencia del mejor puesto por temporada/ }),
    ).toHaveAttribute('aria-labelledby', 'school-trend-title school-trend-description');
    expect(screen.getByText(/Solo hay datos de una temporada/)).toBeInTheDocument();
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
    const { router } = renderHistory('/schools/uni?tab=contests');
    await screen.findByRole('heading', { level: 1, name: 'University' });
    expect(screen.getByText('Alcance institucional')).toBeInTheDocument();
    expect(screen.getByText(/Resultados directos de UNI y de sus unidades/)).toBeInTheDocument();
    expect(statistic('Resultados de equipos')).toHaveTextContent('3');
    expect(statistic('Equipos')).toHaveTextContent('3');
    expect(statistic('Podios')).toHaveTextContent('4');
    expect(screen.getAllByRole('link', { name: 'Ver concurso completo' })).toHaveLength(3);
    await user.click(screen.getByRole('link', { name: 'Ver solo resultados directos' }));
    expect(router.state.location.search).toBe('?tab=contests&scope=school');
    expect(statistic('Resultados de equipos')).toHaveTextContent('0');
    expect(
      screen.getByText('Esta escuela todavía no tiene resultados de concursos publicados.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Incluir unidades descendientes' }));
    expect(router.state.location.search).toBe('?tab=contests&scope=institution');
    expect(statistic('Resultados de equipos')).toHaveTextContent('3');
  });

  it('links qualifier, Mexico Finals and accumulated podiums to their scoreboards', async () => {
    renderHistory('/schools/unit', {
      status: 'ready',
      data: {
        ...archive,
        contests: [
          contest,
          {
            ...contest,
            id: '2024-mexico-finals',
            seriesId: 'mexico-finals',
            stage: 'final',
            name: 'Final México',
          },
        ],
      },
    });
    await screen.findByRole('heading', { level: 1, name: 'Unit' });
    expect(statistic('Podios')).toHaveTextContent('3');
    expect(statistic('Resultados de equipos')).toHaveTextContent('4');
    const podiums = screen.getByRole('list', { name: 'Podios destacados' });
    for (const [name, href] of [
      ['Contest', `/scoreboards?contest=${contest.id}`],
      ['Final México', '/scoreboards?contest=2024-mexico-finals'],
      [
        'GPM 2024 · Clasificación acumulada',
        '/scoreboards?season=2024&series=gpm&view=accumulated',
      ],
    ]) {
      expect(within(podiums).getByRole('link', { name })).toHaveAttribute('href', href);
    }
  });

  it('shows accumulated-only podium highlights and trend points without inventing contest statistics', async () => {
    renderHistory('/schools/unit', {
      status: 'ready',
      data: {
        ...archive,
        contests: [],
        seasonStandings: [
          {
            ...archive.seasonStandings[0],
            snapshot: 'unconfirmed',
            snapshotLabel: 'Acumulado hasta la tercera fecha',
          },
        ],
      },
    });
    await screen.findByRole('heading', { level: 1, name: 'Unit' });
    expect(statistic('Resultados de equipos')).toHaveTextContent('0');
    expect(statistic('Podios')).toHaveTextContent('1');
    expect(bestPlace()).toHaveTextContent('#1');
    const podiums = screen.getByRole('list', { name: 'Podios destacados' });
    expect(within(podiums).getByText('Alpha')).toBeInTheDocument();
    expect(
      within(podiums).getByRole('link', { name: 'GPM 2024 · Clasificación acumulada' }),
    ).toHaveAttribute('href', '/scoreboards?season=2024&series=gpm&view=accumulated');
    expect(within(podiums).getByRole('alert')).toHaveTextContent(
      'Acumulado hasta la tercera fecha (no confirmado como final)',
    );
    expect(
      screen.getByRole('img', { name: /Tendencia del mejor puesto por temporada/ }),
    ).toBeInTheDocument();
    expect(document.querySelector('[data-season="2024"]')).toHaveAttribute('data-place', '1');
    await userEvent.click(screen.getByRole('tab', { name: 'Clasificaciones acumuladas' }));
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
    await userEvent.click(screen.getByRole('tab', { name: 'Resultados por concursos' }));
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
    '/schools/uni?sort=unknown',
    '/schools/uni?team=a&team=b',
    '/schools/uni?season=invalid',
    '/schools/uni?accumulatedSort=invalid',
    '/schools/uni?accumulatedSeason=invalid',
    '/schools/uni?accumulatedTeam=a&accumulatedTeam=b',
    '/schools/uni?series=invalid',
    '/schools/uni?series=gpm-qualifiers&series=mexico-finals',
    '/schools/uni?tab=invalid',
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

  it('filters accumulated results independently and resets without losing contest filters or scope', async () => {
    const user = userEvent.setup();
    const { router } = renderHistory(
      '/schools/unit?scope=school&team=Delta&accumulatedSort=score&tab=accumulated',
    );
    await screen.findByRole('heading', { level: 1, name: 'Unit' });
    const results = () => screen.getByRole('list', { name: 'Resultados acumulados' });
    const count = () => screen.getByRole('status', { name: 'Recuento de acumulados' });
    expect(count()).toHaveTextContent('2 de 2 resultados acumulados');
    expect(within(results()).getAllByRole('listitem')[0]).toHaveTextContent('Alpha');
    expect(
      screen.getByText(
        'Los puntajes publicados pueden usar unidades o escalas distintas entre temporadas.',
      ),
    ).toBeVisible();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Ordenar acumulados por' }),
      'team',
    );
    await user.type(screen.getByRole('textbox', { name: 'Nombre del equipo acumulado' }), 'Alpha');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Temporada acumulada' }), '2024');
    expect(count()).toHaveTextContent('1 de 2 resultados acumulados');
    expect(within(results()).queryByText('Delta')).not.toBeInTheDocument();
    expect(new URLSearchParams(router.state.location.search).get('team')).toBe('Delta');
    expect(statistic('Podios')).toHaveTextContent('2');
    await user.type(
      screen.getByRole('textbox', { name: 'Nombre del equipo acumulado' }),
      'missing',
    );
    expect(
      screen.getByText('No hay clasificaciones acumuladas que coincidan con estos filtros.'),
    ).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Resultados acumulados' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Restablecer acumulados' }));
    expect(router.state.location.search).toBe('?scope=school&team=Delta&tab=accumulated');
    expect(count()).toHaveTextContent('2 de 2 resultados acumulados');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Ordenar acumulados por' }),
      'place',
    );
    await user.click(screen.getByRole('tab', { name: 'Resultados por concursos' }));
    await user.click(screen.getByRole('button', { name: 'Restablecer resultados' }));
    expect(router.state.location.search).toBe('?scope=school&tab=contests&accumulatedSort=place');
  });

  it('restores accumulated controls from the URL for an accumulated-only school history', async () => {
    renderHistory(
      '/schools/unit?accumulatedTeam=Alpha&accumulatedSeason=2020&accumulatedSort=place&tab=accumulated',
      {
        status: 'ready',
        data: { ...archive, contests: [] },
      },
    );
    await screen.findByRole('heading', { level: 1, name: 'Unit' });
    expect(screen.getByRole('textbox', { name: 'Nombre del equipo acumulado' })).toHaveValue(
      'Alpha',
    );
    expect(screen.getByRole('combobox', { name: 'Temporada acumulada' })).toHaveValue('2020');
    expect(screen.getByRole('combobox', { name: 'Ordenar acumulados por' })).toHaveValue('place');
    expect(screen.getByRole('status', { name: 'Recuento de acumulados' })).toHaveTextContent(
      '0 de 2',
    );
    expect(statistic('Resultados de equipos')).toHaveTextContent('0');
    expect(statistic('Podios')).toHaveTextContent('1');
  });

  it('filters and sorts only team results with URL state and preserves scope on reset', async () => {
    const user = userEvent.setup();
    const { router } = renderHistory('/schools/unit?scope=school&tab=contests');
    await screen.findByRole('heading', { level: 1, name: 'Unit' });
    const list = () => screen.getByRole('list', { name: 'Resultados de concursos' });
    expect(within(list()).getAllByRole('heading', { level: 3 })).toHaveLength(2);
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Ordenar equipos por' }),
      'place',
    );
    expect(router.state.location.search).toContain('sort=place');
    expect(list().querySelector(':scope > li')).toHaveTextContent('Alpha');
    await user.type(screen.getByRole('textbox', { name: 'Nombre del equipo' }), 'alpha');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Temporada' }), '2024');
    expect(within(list()).queryByText('Delta')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Recuento de concursos' })).toHaveTextContent(
      '1 de 2 resultados',
    );
    expect(statistic('Resultados de equipos')).toHaveTextContent('2');
    expect(statistic('Podios')).toHaveTextContent('2');
    await user.clear(screen.getByRole('textbox', { name: 'Nombre del equipo' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre del equipo' }), 'missing');
    expect(screen.queryByRole('list', { name: 'Resultados de concursos' })).not.toBeInTheDocument();
    expect(screen.getByText('No hay resultados que coincidan con estos filtros.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Restablecer resultados' }));
    expect(router.state.location.search).toBe('?scope=school&tab=contests');
    expect(within(list()).getByText('Delta')).toBeInTheDocument();
  });

  it('restores result controls from the URL and preserves filters when changing scope', async () => {
    const user = userEvent.setup();
    const { router } = renderHistory('/schools/uni?team=Beta&season=2024&sort=team&tab=contests');
    await screen.findByRole('heading', { level: 1, name: 'University' });
    expect(screen.getByRole('textbox', { name: 'Nombre del equipo' })).toHaveValue('Beta');
    expect(screen.getByRole('combobox', { name: 'Temporada' })).toHaveValue('2024');
    expect(screen.getByRole('combobox', { name: 'Ordenar equipos por' })).toHaveValue('team');
    expect(screen.getByRole('status', { name: 'Recuento de concursos' })).toHaveTextContent(
      '1 de 3 resultados',
    );
    await user.click(screen.getByRole('link', { name: 'Ver solo resultados directos' }));
    expect(new URLSearchParams(router.state.location.search).get('team')).toBe('Beta');
    await user.click(screen.getByRole('link', { name: 'Incluir unidades descendientes' }));
    expect(screen.getByRole('textbox', { name: 'Nombre del equipo' })).toHaveValue('Beta');
    expect(screen.getByRole('status', { name: 'Recuento de concursos' })).toHaveTextContent(
      '1 de 3 resultados',
    );
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
