import { screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { archive, standing } from '@/test/fixtures/archive';
import { renderApp } from '@/test/test-utils';

import { AccumulatedHeader } from './AccumulatedHeader';
import { AccumulatedStandings } from './AccumulatedStandings';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe.each([false, true])('accumulated presentation (desktop=%s)', (desktop) => {
  const renderStanding = (rows = standing.rows) => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: desktop && query.includes('min-width:900px'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    return renderApp(<AccumulatedStandings archive={archive} standing={{ ...standing, rows }} />);
  };

  it('preserves published rows, exact scores and a supported boundary', () => {
    renderStanding();
    const results = screen.getByRole(desktop ? 'table' : 'list', {
      name: 'Clasificación acumulada 2024',
    });
    expect(within(results).getByText('12.75')).toBeInTheDocument();
    expect(within(results).getByText('9.25')).toBeInTheDocument();
    expect(within(results).getAllByText('Clasificado', { exact: true })).toHaveLength(2);
    expect(within(results).getAllByText('No clasificado', { exact: true })).toHaveLength(2);
    expect(results.querySelectorAll('[data-cut="true"]')).toHaveLength(1);
    expect(results.querySelector('[data-cut="true"]')).toHaveTextContent('Beta');
    expect(screen.getByText('Línea de corte de clasificación')).toBeInTheDocument();
    if (desktop) {
      expect(screen.getByRole('region')).toHaveAttribute('tabindex', '0');
      expect(
        within(results).getByRole('columnheader', { name: 'Puntaje publicado' }),
      ).toBeInTheDocument();
    }
  });

  it.each(['qualified-only', 'unqualified-only', 'noncontiguous', 'tied-boundary'] as const)(
    'does not invent a cutoff for %s',
    (scenario) => {
      const rows = standing.rows.map((row, index) => ({
        ...row,
        qualified:
          scenario === 'qualified-only' ||
          (scenario === 'noncontiguous'
            ? index % 2 === 0
            : scenario === 'tied-boundary' && index < 2),
        place: scenario === 'tied-boundary' && index === 2 ? 2 : row.place,
      }));
      renderStanding(rows);
      const results = screen.getByRole(desktop ? 'table' : 'list', {
        name: 'Clasificación acumulada 2024',
      });
      expect(results.querySelector('[data-cut="true"]')).not.toBeInTheDocument();
      expect(screen.queryByText('Línea de corte de clasificación')).not.toBeInTheDocument();
      expect(within(results).getAllByText(desktop ? '#2' : 'Puesto #2')).toHaveLength(
        scenario === 'tied-boundary' ? 2 : 1,
      );
      expect(within(results).getByText('12.75')).toBeInTheDocument();
    },
  );

  it('has an honest empty state', () => {
    renderStanding([]);
    expect(screen.getByRole('alert')).toHaveTextContent('todavía no tiene equipos publicados');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});

it('labels archive provenance without claiming calculated scores or contest metadata', () => {
  renderApp(
    <MemoryRouter>
      <AccumulatedHeader standing={standing} datasetSource="archive" />
    </MemoryRouter>,
  );
  expect(screen.getByText(/Huron Scoreboards no calcula/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Clasificación oficial' })).toHaveAttribute(
    'href',
    standing.source,
  );
  expect(screen.queryByText(/inventados/)).not.toBeInTheDocument();
});
