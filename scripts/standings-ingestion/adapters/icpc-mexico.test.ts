import { describe, expect, it } from 'vitest';

import {
  discoverICPCMexicoIndex,
  discoverICPCMexicoScoreboard,
  discoverICPCMexicoSeason,
  parseICPCMexicoScoreboard,
} from './icpc-mexico';

const indexHtml = `<!doctype html>
<html><body>
  <h2>Temporada 2026</h2>
  <a href="/contests/gpmx-2026">TEMPORADA Gran Premio de México 2026</a>
  <a href="/contests/gpmx-2026-fecha-0">Gran Premio MX 2026 — Fecha 0</a>
  <a href="/contests/gpmx-2026-fecha-1">Primera Fecha</a>
  <a href="/contests/gpmx-2026-fecha-1">Primera Fecha repetida</a>
  <a href="/contests/gpmx-2026-fecha-2">Segunda Fecha</a>
  <a href="/contests/gpmx-2026-fecha-3">Tercera Fecha</a>
  <a href="/contests/gpmx-2026-repechaje">Repechaje</a>
  <a href="/contests/regional-mexico-2026">Final Regional de México</a>
  <a href="/contests/campeonato-latam-2026">Campeonato LATAM</a>
  <a href="/contests/tcmx-2026">Training Camp México</a>
  <a href="/contests/gpmx-2026-masters">ICPC México Masters</a>
  <a href="/contests/gpmx-2026-coding-cup">Coding Cup</a>
  <a href="https://example.com/contests/gpmx-2026-fecha-1">Imitated external contest</a>
  <a href="/rules">Reglamento</a>
  <h2>Temporada 2025</h2>
  <a href="/contests/gpmx-2024-fecha-1">Mismatched edition label</a>
</body></html>`;

const scoreboardHtml = (expectedRows = 2, unusualCell = '(2)') => `<!doctype html>
<html lang="es"><body><main><header>
  <h1>Scoreboard</h1>
  <p>Gran Premio MX 2025 — Primera Fecha</p>
  <p>${String(expectedRows)} equipos registrados · 2 con envíos · 2 problemas · inició 3 de mayo de 2025 a las 11:00 a.m.</p>
</header><table><thead><tr>
  <th>#</th><th>Equipo</th><th title="Problemas resueltos">✓</th>
  <th title="Penalización total (20m por intento incorrecto antes del AC)">Pen</th>
  <th>A</th><th>B</th>
</tr></thead><tbody>
  <tr><td>1</td><td><div><p title="Alpha">Alpha</p><p title="School Alpha">School Alpha</p></div></td><td>1</td><td>90</td>
    <td><div>50</div><div>+2</div></td><td>·</td></tr>
  <tr><td>2</td><td><div><p title="Beta">Beta</p><p title="School Beta">School Beta</p></div></td><td>0</td><td>0</td>
    <td>${unusualCell}</td><td>·</td></tr>
</tbody></table></main></body></html>`;

describe('ICPC Mexico contest index adapter', () => {
  it('classifies GPM stages and Mexico Finals from explicit URL patterns', () => {
    const result = discoverICPCMexicoIndex(indexHtml);
    expect(result.seasons).toEqual([2026, 2025]);
    const recognized = result.discoveries.filter((entry) => entry.status === 'recognized');
    expect(
      recognized.map((entry) => [
        entry.kind,
        entry.seasonYear,
        entry.kind === 'contest' ? entry.stage : null,
      ]),
    ).toEqual([
      ['gpm-season', 2026, null],
      ['contest', 2026, 'fecha-0'],
      ['contest', 2026, 'qualifier-1'],
      ['contest', 2026, 'qualifier-2'],
      ['contest', 2026, 'qualifier-3'],
      ['contest', 2026, 'repechage'],
      ['contest', 2026, 'final'],
    ]);
    expect(result.duplicateUrls).toEqual(['https://www.icpcmexico.org/contests/gpmx-2026-fecha-1']);
  });

  it('excludes only explicit LATAM/training links and stages unknown or mismatched entries', () => {
    const result = discoverICPCMexicoIndex(indexHtml);
    expect(result.discoveries).toContainEqual(
      expect.objectContaining({
        status: 'excluded',
        reason: 'latam-championship',
      }),
    );
    expect(result.discoveries).toContainEqual(
      expect.objectContaining({
        status: 'excluded',
        reason: 'training-camp',
      }),
    );
    expect(result.discoveries).toContainEqual(
      expect.objectContaining({
        status: 'excluded',
        reason: 'masters',
        linkText: 'ICPC México Masters',
      }),
    );
    expect(result.discoveries).toContainEqual(
      expect.objectContaining({
        status: 'staged',
        reason: 'unknown-icpc-mexico-event',
        linkText: 'Coding Cup',
      }),
    );
    expect(result.discoveries).toContainEqual(
      expect.objectContaining({
        status: 'staged',
        reason: 'outside-contests-origin',
      }),
    );
    expect(result.discoveries).toContainEqual(
      expect.objectContaining({
        status: 'staged',
        reason: 'section-year-mismatch',
        sectionYear: 2025,
      }),
    );
    expect(
      result.discoveries.some((entry) => 'linkText' in entry && entry.linkText === 'Reglamento'),
    ).toBe(false);
  });

  it('preserves provisional and live publication labels without treating them as final', () => {
    const result = discoverICPCMexicoIndex(`
      <h2>Temporada 2025</h2>
      <a href="/contests/gpmx-2025-fecha-1">Provisional</a>
      <a href="/contests/gpmx-2025-fecha-2">En curso</a>`);
    expect(
      result.discoveries
        .filter((entry) => entry.status === 'recognized' && entry.kind === 'contest')
        .map((entry) => entry.publicationState),
    ).toEqual(['provisional', 'live']);
  });

  it('finds exactly one accumulated-standing link and reports missing or ambiguous links', () => {
    const withAccumulated = `
      <h1>Gran Premio de México 2026</h1>
      <a href="/contests/gpmx-2026/acumulado">Vista solo acumulado</a>
      <a href="/rules/gran-premio-mexico-2026">Reglamento</a>`;
    expect(discoverICPCMexicoSeason(withAccumulated, 2026)).toMatchObject({
      seasonYear: 2026,
      accumulatedUrl: 'https://www.icpcmexico.org/contests/gpmx-2026/acumulado',
      stagedLinks: [],
    });
    expect(discoverICPCMexicoSeason('<h1>GPM 2025</h1>', 2025)).toEqual({
      seasonYear: 2025,
      accumulatedUrl: null,
      stagedLinks: [],
    });
    expect(
      discoverICPCMexicoSeason(
        `${withAccumulated}<a href="/contests/gpmx-2026/acumulado">Second</a>`,
        2026,
      ).stagedLinks,
    ).toHaveLength(2);
  });

  it('resolves one same-origin scoreboard destination and stages absent, external, or ambiguous links', () => {
    const eventUrl = 'https://www.icpcmexico.org/contests/gpmx-2025-fecha-1';
    expect(
      discoverICPCMexicoScoreboard(
        '<a href="/contests/gpmx-2025-fecha-1/scoreboard">Vista solo scoreboard</a>',
        eventUrl,
      ),
    ).toEqual({
      status: 'found',
      eventUrl,
      scoreboardUrl: `${eventUrl}/scoreboard`,
    });
    expect(discoverICPCMexicoScoreboard('<p>No scoreboard link</p>', eventUrl)).toMatchObject({
      status: 'missing',
      scoreboardUrl: null,
    });
    expect(
      discoverICPCMexicoScoreboard(
        '<a href="https://example.com/scoreboard">Scoreboard</a>',
        eventUrl,
      ),
    ).toMatchObject({
      status: 'staged',
      scoreboardUrl: null,
      stagedLinks: [
        expect.objectContaining({ reason: 'scoreboard destination is outside ICPC Mexico' }),
      ],
    });
    expect(
      discoverICPCMexicoScoreboard(
        '<a href="/contests/gpmx-2025-fecha-1/resultados.pdf">Scoreboard PDF</a>',
        eventUrl,
      ),
    ).toMatchObject({
      status: 'staged',
      scoreboardUrl: null,
      stagedLinks: [
        expect.objectContaining({ reason: 'PDF destination awaits the document pipeline' }),
      ],
    });
    expect(
      discoverICPCMexicoScoreboard(
        '<a href="/scoreboard">Scoreboard A</a><a href="/other/scoreboard">Scoreboard B</a>',
        eventUrl,
      ),
    ).toMatchObject({
      status: 'staged',
      scoreboardUrl: null,
      stagedLinks: [
        expect.objectContaining({ reason: 'multiple scoreboard destinations found' }),
        expect.objectContaining({ reason: 'multiple scoreboard destinations found' }),
      ],
    });
  });
});

describe('ICPC Mexico scoreboard parser', () => {
  const context = {
    seasonYear: 2025,
    seriesId: 'gpm' as const,
    stage: 'qualifier-1' as const,
    sourceEditionLabel: '2025',
    publicationState: 'final' as const,
  };

  it('preserves cell boundaries, attempt semantics, totals, and cell evidence', () => {
    const candidate = parseICPCMexicoScoreboard(scoreboardHtml(), context);
    expect(candidate).toMatchObject({
      sourceEditionLabel: '2025',
      contest: {
        seasonYear: 2025,
        seriesId: 'gpm',
        stage: 'qualifier-1',
        name: 'Gran Premio MX 2025 — Primera Fecha',
        publicationState: 'final',
        date: '2025-05-03',
        durationMinutes: null,
        penaltyMinutesPerFailedAttempt: 20,
        problemLabels: ['A', 'B'],
      },
      coverage: { expectedRowCount: 2, rowsComplete: true, paginationComplete: true },
      rows: [
        {
          place: 1,
          teamName: 'Alpha',
          schoolName: 'School Alpha',
          results: [
            { status: 'solved', attempts: 3, solvedAtMinute: 50 },
            { status: 'unattempted' },
          ],
          publishedTotals: { solved: 1, penalty: 90 },
        },
        {
          place: 2,
          teamName: 'Beta',
          results: [{ status: 'attempted', attempts: 2 }, { status: 'unattempted' }],
          publishedTotals: { solved: 0, penalty: 0 },
        },
      ],
    });
    expect(candidate.rows[0].evidence).toContainEqual(
      expect.objectContaining({
        field: 'rows[0].results.A',
        locator: 'table tbody tr:nth-child(1) td:nth-child(5)',
        excerpt: '50 +2',
      }),
    );
    expect(candidate.rows[0].sourceTeamId).toBeNull();
  });

  it('preserves non-Mexican participating schools in GPM scoreboards', () => {
    const internationalHtml = scoreboardHtml().replaceAll(
      'School Alpha',
      'Universidad de Costa Rica',
    );
    const candidate = parseICPCMexicoScoreboard(internationalHtml, context);
    expect(candidate.rows).toHaveLength(2);
    expect(candidate.rows[0].schoolName).toBe('Universidad de Costa Rica');
    expect(candidate.coverage.rowsComplete).toBe(true);
  });

  it('retains totals and reports incomplete problem detail when cell notation is unknown', () => {
    const candidate = parseICPCMexicoScoreboard(scoreboardHtml(2, 'AC? 50'), context);
    expect(candidate.rows[1]).toMatchObject({
      results: null,
      publishedTotals: { solved: 0, penalty: 0 },
    });
    expect(candidate.coverage.rowsComplete).toBe(true);
    expect(candidate.warnings).toContain(
      'Problem detail for scoreboard row 2 is incomplete; published totals were retained.',
    );
  });

  it('does not claim complete row coverage when page counts disagree', () => {
    const candidate = parseICPCMexicoScoreboard(scoreboardHtml(10), context);
    expect(candidate.coverage).toEqual({
      expectedRowCount: 10,
      rowsComplete: false,
      paginationComplete: null,
    });
    expect(candidate.warnings).toContain('Registered-team count 10 does not match 2 table rows.');
  });

  it.each([
    '<html><body>No table here</body></html>',
    '<table><thead><tr><th>Place</th><th>Team</th></tr></thead></table>',
    scoreboardHtml().replace('<td>1</td>', '<td>first</td>'),
  ])('fails closed on unrecognized or truncated table structure', (html) => {
    expect(() => parseICPCMexicoScoreboard(html, context)).toThrow();
  });
});
