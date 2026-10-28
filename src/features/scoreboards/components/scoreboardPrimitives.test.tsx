import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AppProviders } from '@/app/providers/AppProviders';
import { createAppTheme } from '@/app/theme/appTheme';
import { selectContestRows } from '@/features/scoreboards/model/selectors';
import { archive, contest } from '@/test/fixtures/archive';
import { renderApp } from '@/test/test-utils';

import { ContestHeader } from './ContestHeader';
import { ProblemResultCell } from './ProblemResultCell';
import { ProblemResults } from './ProblemResults';
import { ResultsLegend } from './ResultsLegend';
import { SchoolIdentity } from './SchoolIdentity';
import { SourceCallout } from './SourceCallout';
import { TeamIdentity } from './TeamIdentity';

import type { ProblemResult, Team } from '../model/schemas';

describe('ProblemResultCell', () => {
  it.each<{ result: ProblemResult; label: string; firstToSolve?: boolean }>([
    { result: { status: 'unattempted' }, label: 'Sin intentar' },
    { result: { status: 'attempted', attempts: 1 }, label: '1 intento fallido, sin resolver' },
    { result: { status: 'attempted', attempts: 4 }, label: '4 intentos fallidos, sin resolver' },
    {
      result: { status: 'solved', attempts: 1, solvedAtMinute: 0 },
      label: 'Resuelto en 1 intento al minuto 0',
    },
    {
      result: { status: 'solved', attempts: 3, solvedAtMinute: 300 },
      label: 'Resuelto en 3 intentos al minuto 300',
      firstToSolve: true,
    },
  ])('exposes $label to focus and hover', async ({ result, label, firstToSolve }) => {
    const user = userEvent.setup();
    renderApp(
      <ProblemResultCell
        problem={{ label: 'A', title: 'Algoritmos' }}
        result={result}
        firstToSolve={firstToSolve}
        teamName="Equipo Alfa"
      />,
    );
    const cell = screen.getByRole('img', { name: new RegExp(label) });
    expect(cell).toHaveAccessibleName(new RegExp('Equipo Alfa. Problema A: Algoritmos.'));
    await user.tab();
    expect(cell).toHaveFocus();
    await user.tab();
    await user.hover(cell);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(label);
    if (result.status === 'solved') {
      expect(cell).toHaveAccessibleName(/incluyen el envío aceptado/);
      expect(
        screen.getByText(`${String(result.attempts)} · ${String(result.solvedAtMinute)}`),
      ).toBeInTheDocument();
    }
    expect(screen.queryByText('FTS') !== null).toBe(firstToSolve ?? false);
  });

  it.each(['light', 'dark'] as const)(
    'uses semantic tokens and minimum dimensions in %s',
    (mode) => {
      const theme = createAppTheme(mode);
      renderApp(
        <AppProviders initialMode={mode}>
          <ProblemResultCell
            problem={{ label: 'A' }}
            result={{ status: 'solved', attempts: 1, solvedAtMinute: 8 }}
            firstToSolve
          />
        </AppProviders>,
      );
      const cell = screen.getByRole('img');
      expect(cell).toHaveStyle({
        backgroundColor: theme.palette.scoreboard.firstSolve,
        color: theme.palette.scoreboard.firstSolveText,
        minWidth: '68px',
        minHeight: '48px',
      });
    },
  );

  it('does not treat unsolved results as first solves', () => {
    renderApp(
      <ProblemResultCell
        problem={{ label: 'B' }}
        result={{ status: 'unattempted' }}
        firstToSolve
      />,
    );
    expect(screen.getByRole('img')).toHaveAccessibleName('Problema B. Sin intentar');
    expect(screen.queryByText('FTS')).not.toBeInTheDocument();
  });
});

describe('ordered problem results and legend', () => {
  it('retains arbitrary contest order and the derived tied first solves without recomputing scoring', () => {
    const rows = selectContestRows(archive, contest);
    renderApp(
      <>
        {rows.slice(0, 2).map((row) => (
          <ProblemResults
            key={row.teamId}
            problems={[contest.problems[1], contest.problems[0], contest.problems[2]]}
            results={[row.results[1], row.results[0], row.results[2]]}
            firstSolvedLabels={row.firstSolvedLabels}
            teamName={row.team.name}
          />
        ))}
        <ResultsLegend />
      </>,
    );
    const alpha = within(screen.getByRole('list', { name: 'Resultados por problema de Alpha' }));
    expect(alpha.getAllByRole('img').map((cell) => cell.getAttribute('aria-label'))).toEqual([
      'Alpha. Problema B. 9 intentos fallidos, sin resolver',
      'Alpha. Problema A. Resuelto en 2 intentos al minuto 10; los intentos incluyen el envío aceptado; primero en resolver (posible empate)',
      'Alpha. Problema C. Sin intentar',
    ]);
    expect(screen.getAllByRole('img', { name: /primero en resolver/ })).toHaveLength(2);
    expect(screen.getByRole('complementary', { name: 'Leyenda de resultados' })).toHaveTextContent(
      'puede haber empates',
    );
    expect(screen.getByText(/Los intentos incluyen el envío aceptado/)).toBeInTheDocument();
  });

  it('rejects misaligned problem arrays explicitly', () => {
    expect(() =>
      renderApp(
        <ProblemResults
          problems={contest.problems}
          results={[]}
          firstSolvedLabels={[]}
          teamName="Alpha"
        />,
      ),
    ).toThrow('one result per problem');
  });
});

describe('team and school identities', () => {
  it.each([undefined, []])(
    'explains unavailable rosters (%j) without inventing members',
    (members) => {
      renderApp(<TeamIdentity team={{ ...archive.teams[0], members }} />);
      expect(screen.getByText('Alpha')).toBeInTheDocument();
      expect(screen.getByText('Integrantes no disponibles')).toBeInTheDocument();
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    },
  );

  it('supports roster disclosure and only labels roles when provided', async () => {
    const user = userEvent.setup();
    const team: Team = {
      ...archive.teams[0],
      members: [
        { name: 'Ana', role: 'contestant' },
        { name: 'Bruno', role: 'coach' },
        { name: 'Carmen' },
      ],
    };
    renderApp(<TeamIdentity team={team} />);
    const summary = screen.getByText('Integrantes de Alpha');
    expect(screen.getByText('Carmen')).not.toBeVisible();
    await user.tab();
    expect(summary).toHaveFocus();
    await user.click(summary);
    expect(screen.getByText('Ana — Concursante')).toBeVisible();
    expect(screen.getByText('Bruno — Entrenador/a')).toBeVisible();
    expect(screen.getByText('Carmen')).toBeVisible();
  });

  it('preserves competing units and optional location without dead school links', () => {
    renderApp(<SchoolIdentity school={{ ...archive.schools[1], city: 'Ciudad de México' }} />);
    expect(screen.getByText('UNIT')).toBeInTheDocument();
    expect(screen.getByText('Unit')).toBeInTheDocument();
    expect(screen.getByText('Ciudad de México')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText(/undefined|null/)).not.toBeInTheDocument();
  });

  it('supports explicit school links, root-relative logos and complete location', () => {
    renderApp(
      <MemoryRouter>
        <SchoolIdentity
          school={{
            ...archive.schools[1],
            logo: 'logos/unit.svg',
            city: 'Ciudad',
            state: 'Estado',
          }}
          href="/schools/unit"
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'UNIT' })).toHaveAttribute('href', '/schools/unit');
    expect(screen.getByRole('img', { name: 'Logo de Unit' })).toHaveAttribute(
      'src',
      '/logos/unit.svg',
    );
    expect(screen.getByText('Ciudad, Estado')).toBeInTheDocument();
  });

  it('reports a failed remote logo visibly and retries when the school changes', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const { rerender } = renderApp(
        <SchoolIdentity
          school={{
            ...archive.schools[1],
            logo: 'https://example.com/unit.svg',
          }}
        />,
      );
      fireEvent.error(screen.getByRole('img'));
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.getByText('Logo no disponible')).toBeInTheDocument();
      expect(log).toHaveBeenCalledWith(
        'Could not load school logo: unit',
        'https://example.com/unit.svg',
      );
      rerender(
        <SchoolIdentity school={{ ...archive.schools[3], logo: 'https://example.com/solo.svg' }} />,
      );
      expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/solo.svg');
    } finally {
      log.mockRestore();
    }
  });

  it.each(['data:image/svg+xml,<svg onload=alert(1) />', 'http://example.com/unit.svg'])(
    'never uses the unvalidated logo %s as an image source',
    (logo) => {
      renderApp(<SchoolIdentity school={{ ...archive.schools[1], logo }} />);
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    },
  );
});

describe('contest header and provenance', () => {
  it('uses canonical season/stage/source fields, a timezone-stable date, and contest-specific penalty', () => {
    renderApp(
      <MemoryRouter>
        <ContestHeader contest={contest} datasetSource="archive" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Contest');
    expect(screen.getByRole('navigation', { name: 'Jerarquía del concurso' })).toHaveTextContent(
      'Temporada 2024',
    );
    expect(screen.getByText('Clasificatoria 1')).toBeInTheDocument();
    expect(screen.getByText('Gran Premio de México')).toBeInTheDocument();
    expect(screen.getByText('1 de marzo de 2024')).toHaveAttribute('datetime', '2024-03-01');
    expect(screen.getByText('Penalización: +15 min por intento fallido')).toBeInTheDocument();
    expect(screen.getByText('3 problemas')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Clasificación oficial' })).toHaveAttribute(
      'href',
      contest.source,
    );
    expect(screen.getByRole('link', { name: 'Cómo corregir estos datos' })).toHaveAttribute(
      'href',
      '/contribute',
    );
  });

  it('labels invented records honestly and handles unknown series and a zero penalty', () => {
    renderApp(
      <MemoryRouter>
        <ContestHeader
          contest={{
            ...contest,
            seriesId: 'new-series',
            penaltyMinutesPerFailedAttempt: 0,
          }}
          datasetSource="mock"
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('new series')).toBeInTheDocument();
    expect(screen.getByText('Concurso de demostración')).toBeInTheDocument();
    expect(screen.getByText('Penalización: +0 min por intento fallido')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('resultados inventados');
    expect(screen.queryByRole('link', { name: 'Clasificación oficial' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fuente de ejemplo' })).toHaveAttribute(
      'href',
      contest.source,
    );
  });

  it('can show source attribution independently of the header', () => {
    renderApp(
      <MemoryRouter>
        <SourceCallout source="https://example.com/official" datasetSource="archive" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('fuente oficial');
    expect(screen.getByRole('link', { name: 'Clasificación oficial' })).toHaveAttribute(
      'href',
      'https://example.com/official',
    );
  });
});
