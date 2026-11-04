import { screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { archive, contest, standing } from '@/test/fixtures/archive';
import { renderApp } from '@/test/test-utils';

import { AccumulatedHeader } from './AccumulatedHeader';
import { ContestHeader } from './ContestHeader';
import { ContestStandings } from './ContestStandings';
import { SchoolHistoryResults } from './SchoolHistoryResults';
import { SchoolTrendChart } from './SchoolTrendChart';
import { selectSchoolHistoryPresentation } from '../model/schoolHistory';
import { selectContestRows } from '../model/selectors';

afterEach(() => vi.unstubAllGlobals());

describe.each([false, true])('unknown published places (desktop=%s)', (desktop) => {
  it('retains the unranked team and warns without inventing a place', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: desktop && query.includes('min-width:900px'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const historical = {
      ...contest,
      standings: contest.standings.map((row) => ({ ...row, place: null })),
      publicationNotes: ['La fuente deja equipos sin puesto.'],
    };
    renderApp(
      <MemoryRouter>
        <ContestHeader contest={historical} datasetSource="archive" />
        <ContestStandings contest={historical} rows={selectContestRows(archive, historical)} />
      </MemoryRouter>,
    );
    expect(screen.getByText('La fuente deja equipos sin puesto.')).toBeInTheDocument();
    const results = screen.getByRole(desktop ? 'table' : 'list', {
      name: 'Clasificación de Contest',
    });
    expect(
      within(results).getAllByText(desktop ? 'No publicado' : 'Puesto no publicado'),
    ).toHaveLength(4);
    expect(within(results).getByText('Alpha')).toBeInTheDocument();
    expect(within(results).queryByText('#0')).not.toBeInTheDocument();
  });
});

it('renders accumulated publication notes alongside the official source link', () => {
  renderApp(
    <MemoryRouter>
      <AccumulatedHeader
        standing={{
          ...standing,
          publicationNotes: ['Se preservan registros distintos con el mismo nombre.'],
        }}
        datasetSource="archive"
      />
    </MemoryRouter>,
  );
  expect(
    screen.getByText('Se preservan registros distintos con el mismo nombre.'),
  ).toBeInTheDocument();
});

it('shows unranked school results without a fabricated trend or podium', () => {
  const source = {
    ...archive,
    seasonStandings: [],
    contests: [
      { ...contest, standings: contest.standings.map((row) => ({ ...row, place: null })) },
    ],
  };
  const selection = selectSchoolHistoryPresentation(source, 'unit', 'school');
  if (selection.status !== 'found') {
    throw new Error('Expected school history.');
  }
  renderApp(
    <MemoryRouter>
      <SchoolTrendChart seasons={selection.record.seasons} />
      <SchoolHistoryResults history={selection.record} datasetSource="archive" />
    </MemoryRouter>,
  );
  expect(
    screen.getByText('La fuente no publica puestos para construir una tendencia.'),
  ).toBeInTheDocument();
  expect(document.querySelectorAll('svg circle')).toHaveLength(0);
  expect(screen.getAllByText('No publicado')).toHaveLength(3);
  expect(screen.queryByText('#null')).not.toBeInTheDocument();
});
