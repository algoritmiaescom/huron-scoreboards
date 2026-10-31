import { describe, expect, it } from 'vitest';

import {
  classifyICPCGlobalDocument,
  deduplicateICPCGlobalDestinations,
  discoverICPCGlobalDirectory,
  discoverICPCGlobalFinder,
  discoverICPCGlobalStandingsLink,
  parseICPCGlobalStandings,
} from './icpc-global';

const directoryHtml = `<!doctype html><html><body><table>
  <thead><tr><th>Contest</th><th>Registration</th><th>Standings</th></tr></thead>
  <tbody>
    <tr><td><a href="/regionals/finder/mcapgp-2026">The 2025 ICPC Gran Premio de Mexico</a></td><td>Closed</td><td><a href="https://www.icpcmexico.org/contests/gpmx-2025/acumulado">Results</a></td></tr>
    <tr><td><a href="/regionals/finder/Mexico-2026">The 2025 ICPC Mexico Finals</a></td><td>Closed</td><td><a href="https://scorelatam.naquadah.com.br/latam-2025/">Results</a></td></tr>
    <tr><td><a href="/regionals/finder/MMX-2026">The 2025 ICPC Masters Mexico</a></td><td>Closed</td><td><a href="/standings.pdf">Results</a></td></tr>
    <tr><td><a href="/regionals/finder/MXCPL-2026">The 2025 ICPC Mexican Women Competitive Programming League</a></td><td>Closed</td><td></td></tr>
    <tr><td><a href="/regionals/finder/TCMX-2026">The 2025 ICPC Mexico Training Camp</a></td><td>Closed</td><td></td></tr>
  </tbody>
</table></body></html>`;

const mexicoFinderHtml = `<!doctype html><html><body>
  <h1>The 2025 ICPC Mexico Finals</h1><p>Past Contest</p>
  <a href="/regionals/finder/Mexico-2026/standings">See Standings</a>
  <h2>Contest List</h2>
  <a href="/regionals/finder/mcapgp-2026">The 2025 ICPC Gran Premio de Mexico</a>
  <a href="/regionals/finder/Mexico-2025">See Prior Year</a>
</body></html>`;

const standingsHtml = `<!doctype html><html><body><main>
  <div>Standings for The 2025 ICPC Mexico Finals</div>
  <table><thead><tr><th>Place</th><th>Institution</th><th>Team</th><th>Problems Solved</th><th>Total Time</th><th>Last Solution</th><th>Citation</th></tr></thead>
  <tbody>
    <tr><td>1</td><td>School Alpha</td><td>Team Alpha</td><td>7</td><td>961</td><td>04:43</td><td></td></tr>
    <tr><td>2</td><td>School Beta</td><td>Team Beta</td><td>6</td><td>414</td><td>04:31</td><td></td></tr>
  </tbody></table>
  <p>Rows per page: 1 - 2 of 2</p>
</main></body></html>`;

describe('ICPC Global source adapters', () => {
  it('finds only the Mexican GPM and Finals rows in the selected cycle table', () => {
    expect(discoverICPCGlobalDirectory(directoryHtml, '2025-2026')).toEqual({
      cycleLabel: '2025-2026',
      editionYear: 2025,
      contests: [
        {
          kind: 'gpm',
          editionYear: 2025,
          sourceEditionLabel: '2025',
          name: 'The 2025 ICPC Gran Premio de Mexico',
          contestUrl: 'https://icpc.global/regionals/finder/mcapgp-2026',
          standingsUrl: 'https://www.icpcmexico.org/contests/gpmx-2025/acumulado',
        },
        {
          kind: 'mexico-finals',
          editionYear: 2025,
          sourceEditionLabel: '2025',
          name: 'The 2025 ICPC Mexico Finals',
          contestUrl: 'https://icpc.global/regionals/finder/Mexico-2026',
          standingsUrl: 'https://scorelatam.naquadah.com.br/latam-2025/',
        },
      ],
      excludedContestLabels: [
        'The 2025 ICPC Masters Mexico',
        'The 2025 ICPC Mexican Women Competitive Programming League',
        'The 2025 ICPC Mexico Training Camp',
      ],
      stagedLinks: [],
    });
  });

  it('stages cycle, displayed-edition, and URL-identifier mismatches', () => {
    expect(discoverICPCGlobalDirectory(directoryHtml, '2024-2025').stagedLinks).toHaveLength(2);
    const wrongIdentifier = directoryHtml.replace('Mexico-2026', 'Mexico-2027');
    const stagedReasons = discoverICPCGlobalDirectory(wrongIdentifier, '2025-2026').stagedLinks.map(
      ({ reason }) => reason,
    );
    expect(stagedReasons.some((reason) => reason.includes('URL identifier'))).toBe(true);
    expect(discoverICPCGlobalDirectory(directoryHtml, '2025').stagedLinks[0].reason).toContain(
      'cycle label',
    );
    expect(
      discoverICPCGlobalDirectory('<html></html>', '2025-2026').stagedLinks[0].reason,
    ).toContain('contest table');
  });

  it('records finder standings, GPM child, prior-year context, and final status', () => {
    expect(
      discoverICPCGlobalFinder(
        mexicoFinderHtml,
        'https://icpc.global/regionals/finder/Mexico-2026',
      ),
    ).toEqual({
      finderUrl: 'https://icpc.global/regionals/finder/Mexico-2026',
      title: 'The 2025 ICPC Mexico Finals',
      eventKind: 'mexico-finals',
      editionYear: 2025,
      sourceEditionLabel: '2025',
      standingsUrl: 'https://icpc.global/regionals/finder/Mexico-2026/standings',
      gpmContestUrl: 'https://icpc.global/regionals/finder/mcapgp-2026',
      priorYearUrl: 'https://icpc.global/regionals/finder/Mexico-2025',
      publicationState: 'final',
      stagedLinks: [],
    });
  });

  it('records an absent prior-year link without manufacturing a historical destination', () => {
    const currentEdition = discoverICPCGlobalFinder(
      '<h1>The 2026 ICPC Mexico Finals</h1><a href="/regionals/finder/Mexico-2027/standings">See Standings</a><a href="/regionals/finder/mcapgp-2027">The 2026 ICPC Gran Premio de Mexico</a>',
      'https://icpc.global/regionals/finder/Mexico-2027',
    );
    expect(currentEdition).toMatchObject({
      editionYear: 2026,
      priorYearUrl: null,
      stagedLinks: [],
    });
  });

  it('stages duplicate and off-origin finder buttons', () => {
    const duplicated = discoverICPCGlobalFinder(
      '<h1>The 2025 ICPC Mexico Finals</h1><a href="/one">See Standings</a><a href="/two">See Standings</a>',
      'https://icpc.global/regionals/finder/Mexico-2026',
    );
    expect(
      duplicated.stagedLinks.some(({ reason }) => reason.includes('multiple See Standings')),
    ).toBe(true);
    const external = discoverICPCGlobalFinder(
      '<h1>The 2025 ICPC Mexico Finals</h1><a href="https://example.com/standings">See Standings</a>',
      'https://icpc.global/regionals/finder/Mexico-2026',
    );
    expect(external.stagedLinks.some(({ reason }) => reason.includes('outside the approved'))).toBe(
      true,
    );
  });

  it('allows GPM finder pages without inventing a GPM child link and stages missing standings', () => {
    const gpm = discoverICPCGlobalFinder(
      '<h1>The 2025 ICPC Gran Premio de Mexico</h1><p>Past Contest</p><a href="/regionals/finder/mcapgp-2026/standings">See Standings</a>',
      'https://icpc.global/regionals/finder/mcapgp-2026',
    );
    expect(gpm).toMatchObject({ eventKind: 'gpm', editionYear: 2025, gpmContestUrl: null });
    expect(
      discoverICPCGlobalFinder(
        '<h1>The 2025 ICPC Mexico Finals</h1><a href="/regionals/finder/Mexico-2025">See Prior Year</a>',
        'https://icpc.global/regionals/finder/Mexico-2026',
      ).stagedLinks,
    ).toContainEqual(
      expect.objectContaining({ reason: 'finder page is missing its See Standings link' }),
    );
  });

  it('parses totals-only standings and requires the captured row count to match pagination', () => {
    expect(parseICPCGlobalStandings(standingsHtml)).toMatchObject({
      status: 'ready',
      title: 'Standings for The 2025 ICPC Mexico Finals',
      expectedRowCount: 2,
      rowsComplete: true,
      rows: [
        {
          place: 1,
          institution: 'School Alpha',
          team: 'Team Alpha',
          solved: 7,
          totalTime: 961,
          lastSolution: '04:43',
        },
        {
          place: 2,
          institution: 'School Beta',
          team: 'Team Beta',
          solved: 6,
          totalTime: 414,
        },
      ],
    });
    expect(
      parseICPCGlobalStandings(standingsHtml.replace('1 - 2 of 2', '1 - 2 of 139')),
    ).toMatchObject({
      status: 'staged',
      rowsComplete: false,
      expectedRowCount: 139,
    });
    expect(
      parseICPCGlobalStandings(
        standingsHtml.replace('Rows per page: 1 - 2 of 2', 'Rows per page: 10 1-2 of 2'),
      ),
    ).toMatchObject({ status: 'ready', expectedRowCount: 2 });
    expect(
      parseICPCGlobalStandings(standingsHtml.replace('1 - 2 of 2', '1 - 2 of 2 1 - 2 of 2')),
    ).toMatchObject({ status: 'staged', rowsComplete: false });
  });

  it('dispatches documents from signatures before trusting response content type', () => {
    expect(classifyICPCGlobalDocument('text/html', new TextEncoder().encode('%PDF-1.7'))).toBe(
      'pdf',
    );
    expect(
      classifyICPCGlobalDocument(
        'application/pdf',
        new TextEncoder().encode('<html>blocked</html>'),
      ),
    ).toBe('html');
    expect(
      classifyICPCGlobalDocument(
        null,
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe('image');
  });

  it('recognizes fallback MIME types and common image signatures', () => {
    expect(
      classifyICPCGlobalDocument('application/pdf', new TextEncoder().encode('not a signature')),
    ).toBe('pdf');
    expect(
      classifyICPCGlobalDocument('text/html', new TextEncoder().encode('blocked response')),
    ).toBe('html');
    expect(classifyICPCGlobalDocument('image/jpeg', new Uint8Array())).toBe('image');
    expect(classifyICPCGlobalDocument(null, new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe(
      'image',
    );
    expect(classifyICPCGlobalDocument(null, new TextEncoder().encode('GIF89a'))).toBe('image');
    expect(
      classifyICPCGlobalDocument(
        null,
        new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
      ),
    ).toBe('image');
    expect(classifyICPCGlobalDocument(null, new Uint8Array([0x01, 0x02]))).toBe('unknown');
  });

  it('stages unknown standings layouts and invalid ranking sequences', () => {
    expect(
      parseICPCGlobalStandings(
        '<h1>Standings for ICPC</h1><table><tr><th>Changed</th></tr></table>',
      ),
    ).toMatchObject({
      status: 'staged',
      rowsComplete: false,
    });
    const skippedPlace = standingsHtml
      .replace('<td>2</td><td>School Beta</td>', '<td>3</td><td>School Beta</td>')
      .replace('1 - 2 of 2', '1 - 2 of 2');
    expect(parseICPCGlobalStandings(skippedPlace)).toMatchObject({
      status: 'staged',
      rowsComplete: false,
    });
  });

  it('deduplicates standings destinations shared by the directory and finder', () => {
    expect(
      deduplicateICPCGlobalDestinations([
        'https://icpc.global/regionals/finder/Mexico-2026/standings',
        null,
        'https://icpc.global/regionals/finder/Mexico-2026/standings',
      ]),
    ).toEqual(['https://icpc.global/regionals/finder/Mexico-2026/standings']);
  });

  it('follows exactly one configured standings destination from an HTML landing page', () => {
    expect(
      discoverICPCGlobalStandingsLink(
        '<main><a href="https://acm.iteso.mx/share/results.pdf">Download results</a></main>',
        'https://icpc.global/regionals/finder/mcapgp-2026/results',
      ),
    ).toEqual({
      status: 'found',
      url: 'https://acm.iteso.mx/share/results.pdf',
      linkText: 'Download results',
    });
    expect(
      discoverICPCGlobalStandingsLink(
        '<main><a href="https://example.com/results.pdf">Results</a></main>',
        'https://icpc.global/regionals/finder/mcapgp-2026/results',
      ),
    ).toMatchObject({ status: 'staged' });
    expect(
      discoverICPCGlobalStandingsLink(
        '<main><a href="/a.pdf">Results 1</a><a href="/b.pdf">Results 2</a></main>',
        'https://icpc.global/regionals/finder/mcapgp-2026/results',
      ),
    ).toMatchObject({ status: 'staged' });
  });
});
