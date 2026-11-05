import { describe, expect, it } from 'vitest';

import { discoverScoreLATAMEditions, parseScoreLATAMMexicoScoreboard } from './scorelatam';

import type { ScoreLATAMEdition } from './scorelatam';

const indexHtml = `<!doctype html><html><body>
  <h1>LATAM Competitions</h1>
  <h2>PdA - Programadores de America</h2>
  <a href="/pda26/">2026</a>
  <a href="/pda25/">2025</a>
  <a href="/latam-2019/">2019</a>
  <h2>LATAM</h2>
  <a href="/latam-2025/">2025</a>
  <a href="/latam-2020/">2020 (in 2021, REMOTE due to COVID)</a>
  <a href="/latam-2020/">2020 (in 2021, REMOTE due to COVID)</a>
  <a href="/latam-2024-extra/">2024 extra</a>
  <a href="/latam-2023/">2022</a>
  <a href="https://example.com/latam-2022/">2022</a>
  <h2>Brazilian First Phase</h2>
  <a href="/subbr-2025/">2025</a>
  <h2>Torneo Chileno de Programacion</h2>
  <a href="/subch-2025/">2025</a>
  <h2>Fase Zero</h2>
  <a href="/fzero-2025/">2025</a>
</body></html>`;

const edition: ScoreLATAMEdition = {
  editionYear: 2025,
  playedYear: null,
  sourceEditionLabel: '2025',
  url: 'https://scorelatam.naquadah.com.br/latam-2025/',
};

const mexicoScoreboardHtml = `<!doctype html><html><body>
  <a onclick="toggleGroup(1)">Global</a>
  <a onclick="toggleGroup(17)">Mexico</a>
  <a onclick="toggleGroup(28)">CCL</a>
  <a onclick="toggleGroup(33)">Mexico</a>
  <h2>Final Scoreboard</h2>
  <table id="myscoretable"><tbody>
    <tr><td>#</td><td>User/Site</td><td>Name</td><td>A</td><td>B</td><td>Total</td></tr>
    <tr class="sitegroup1"><td>10</td><td>teammxmx006 /MX</td><td>[School Alpha] Alpha</td><td>3/144</td><td></td><td>1 (184)</td></tr>
    <tr class="sitegroup1"><td>12</td><td>teammxmx007 /MX</td><td>[School Beta] Beta</td><td>3/-</td><td></td><td>0 (0)</td></tr>
    <tr class="sitegroup1"><td>16</td><td>teammxmx008 /MX</td><td>[School Gamma] Gamma</td><td>???</td><td></td><td>0 (0)</td></tr>
    <tr class="sitegroup1"><td>20</td><td>teambrbr001 /BR</td><td>[School Brazil] Brazil Team</td><td>1/99</td><td></td><td>1 (99)</td></tr>
    <tr class="sitegroup17" style="display: none"><td>1</td><td>teammxmx006 /MX</td><td>[School Alpha] Alpha 🎖️ Qualified for Programadores de America in Chile</td><td>white: 3/144</td><td></td><td>1 (184)</td></tr>
    <tr class="sitegroup17" style="display: none"><td>1</td><td>teammxmx007 /MX</td><td>[School Beta] Beta</td><td>3/-</td><td></td><td>0 (0)</td></tr>
    <tr class="sitegroup17" style="display: none"><td>3</td><td>teammxmx008 /MX</td><td>[School Gamma] Gamma</td><td>???</td><td></td><td>0 (0)</td></tr>
    <tr class="sitegroup33"><td>2</td><td>teammxmx006 /MX</td><td>CCL Mexico representation</td><td>3/144</td><td></td><td>1 (184)</td></tr>
  </tbody></table>
</body></html>`;

describe('ScoreLATAM edition discovery', () => {
  it('discovers LATAM editions only and preserves edition and played-year labels separately', () => {
    const result = discoverScoreLATAMEditions(indexHtml);
    expect(result.editions).toEqual([
      {
        editionYear: 2025,
        playedYear: null,
        sourceEditionLabel: '2025',
        url: 'https://scorelatam.naquadah.com.br/latam-2025/',
      },
      {
        editionYear: 2020,
        playedYear: 2021,
        sourceEditionLabel: '2020 (in 2021, REMOTE due to COVID)',
        url: 'https://scorelatam.naquadah.com.br/latam-2020/',
      },
    ]);
    expect(result.duplicateUrls).toEqual(['https://scorelatam.naquadah.com.br/latam-2020/']);
    expect(result.excludedLinks).toEqual([
      expect.objectContaining({
        url: 'https://scorelatam.naquadah.com.br/latam-2019/',
        reason: 'edition is outside the LATAM section',
      }),
    ]);
  });

  it('stages malformed LATAM paths, mismatched labels, and external edition destinations', () => {
    const result = discoverScoreLATAMEditions(indexHtml);
    expect(result.stagedLinks).toEqual([
      expect.objectContaining({
        url: 'https://scorelatam.naquadah.com.br/latam-2024-extra/',
        reason: 'unrecognized LATAM edition URL',
      }),
      expect.objectContaining({
        url: 'https://scorelatam.naquadah.com.br/latam-2023/',
        reason: 'edition label does not match URL year',
      }),
      expect.objectContaining({
        url: 'https://example.com/latam-2022/',
        reason: 'LATAM edition link is outside ScoreLATAM over HTTPS',
      }),
    ]);
  });
});

describe('ScoreLATAM Mexico scoreboard parser', () => {
  it('recognizes a unique country group without requiring a CCL section', () => {
    const html = mexicoScoreboardHtml
      .replace('<a onclick="toggleGroup(28)">CCL</a>', '')
      .replace('<a onclick="toggleGroup(33)">Mexico</a>', '')
      .replace('>Global</a>', '>global</a>');
    expect(parseScoreLATAMMexicoScoreboard(html, edition)).toMatchObject({
      status: 'ready',
      mexicoGroupId: 17,
    });
    expect(
      parseScoreLATAMMexicoScoreboard(html.replace('>Mexico</a>', '>mxmx</a>'), {
        ...edition,
        editionYear: 2019,
      }),
    ).toMatchObject({ status: 'ready', mexicoGroupId: 17 });
    expect(
      parseScoreLATAMMexicoScoreboard(html.replace('>Mexico</a>', '>mxmx</a>'), edition),
    ).toMatchObject({ status: 'staged', rows: [] });
  });

  it('preserves a missing institution without treating its empty brackets as the team name', () => {
    const html = mexicoScoreboardHtml.replaceAll('[School Alpha] Alpha', '[] Alpha');
    expect(parseScoreLATAMMexicoScoreboard(html, edition).rows[0]).toMatchObject({
      teamName: 'Alpha',
      schoolName: null,
    });
  });

  it('uses the Mexico local-place group, preserves global ranks, and verifies /MX membership', () => {
    const result = parseScoreLATAMMexicoScoreboard(mexicoScoreboardHtml, edition);
    expect(result).toMatchObject({
      status: 'ready',
      editionYear: 2025,
      playedYear: null,
      publicationState: 'final',
      sourceEditionLabel: '2025',
      mexicoGroupId: 17,
      eventEquivalence: 'reviewer-approved',
      problemLabels: ['A', 'B'],
      coverage: { rowCount: 3, rowsComplete: true, paginationComplete: true },
      rows: [
        {
          mexicoPlace: 1,
          latamPlace: 10,
          sourceTeamId: 'teammxmx006',
          sourceUserSite: 'teammxmx006/MX',
          teamName: 'Alpha',
          schoolName: 'School Alpha',
          results: [
            { status: 'solved', attempts: 3, solvedAtMinute: 144 },
            { status: 'unattempted' },
          ],
          publishedTotals: { solved: 1, penalty: 184 },
        },
        {
          mexicoPlace: 1,
          latamPlace: 12,
          sourceTeamId: 'teammxmx007',
          results: [{ status: 'attempted', attempts: 3 }, { status: 'unattempted' }],
          publishedTotals: { solved: 0, penalty: 0 },
        },
        {
          mexicoPlace: 3,
          latamPlace: 16,
          sourceTeamId: 'teammxmx008',
          results: null,
          publishedTotals: { solved: 0, penalty: 0 },
        },
      ],
    });
    expect(result.rows[0].evidence).toContainEqual(
      expect.objectContaining({ field: 'rows[0].mexicoPlace', excerpt: '1' }),
    );
    expect(result.rows[0].evidence).toContainEqual(
      expect.objectContaining({ field: 'rows[0].latamPlace', excerpt: '10' }),
    );
    expect(result.rows.every(({ sourceUserSite }) => sourceUserSite.endsWith('/MX'))).toBe(true);
    expect(result.warnings).toContain(
      'Problem detail for teammxmx008/MX is incomplete; published totals were retained.',
    );
    expect(
      parseScoreLATAMMexicoScoreboard(mexicoScoreboardHtml, {
        ...edition,
        editionYear: 2020,
        playedYear: 2021,
        sourceEditionLabel: '2020 (in 2021, REMOTE due to COVID)',
      }).playedYear,
    ).toBe(2021);
  });

  it('deduplicates identical local rows but stages a Mexico-group row without exact /MX membership', () => {
    const duplicateRow =
      '<tr class="sitegroup17"><td>1</td><td>teammxmx006 /MX</td><td>[School Alpha] Alpha</td><td>white: 3/144</td><td></td><td>1 (184)</td></tr>';
    const duplicateHtml = mexicoScoreboardHtml.replace('</tbody>', `${duplicateRow}</tbody>`);
    const deduplicated = parseScoreLATAMMexicoScoreboard(duplicateHtml, edition);
    expect(deduplicated.status).toBe('ready');
    expect(deduplicated.rows).toHaveLength(3);
    expect(deduplicated.warnings).toContain(
      'Duplicate representation for teammxmx006/MX was deduplicated.',
    );

    const invalidMembership = mexicoScoreboardHtml.replace(
      'teammxmx006 /MX</td><td>[School Alpha] Alpha 🎖️',
      'teammxmx006 /mx</td><td>[School Alpha] Alpha 🎖️',
    );
    const staged = parseScoreLATAMMexicoScoreboard(invalidMembership, edition);
    expect(staged.status).toBe('staged');
    expect(staged.reason).toContain('exact /MX User/Site suffix');
    expect(staged.rows).toEqual([]);
  });

  it('stages missing Mexico groups and invalid local ranking instead of deriving placement', () => {
    const noMexicoGroup = mexicoScoreboardHtml.replaceAll('sitegroup17', 'sitegroup99');
    expect(parseScoreLATAMMexicoScoreboard(noMexicoGroup, edition)).toMatchObject({
      status: 'staged',
      reason: 'The Mexico-only score group has no rows.',
      rows: [],
    });

    const missingFirstLocalPlace = mexicoScoreboardHtml
      .replace(
        'sitegroup17" style="display: none"><td>1</td><td>teammxmx006',
        'sitegroup17" style="display: none"><td>2</td><td>teammxmx006',
      )
      .replace(
        'sitegroup17" style="display: none"><td>1</td><td>teammxmx007',
        'sitegroup17" style="display: none"><td>2</td><td>teammxmx007',
      );
    expect(parseScoreLATAMMexicoScoreboard(missingFirstLocalPlace, edition)).toMatchObject({
      status: 'staged',
      reason: 'Mexico-local places do not use standard competition ranking.',
      rows: [],
    });
  });

  it('stages layouts with pagination controls rather than claiming complete group coverage', () => {
    const paginatedHtml = mexicoScoreboardHtml.replace(
      '</body>',
      '<nav aria-label="Pagination"><a rel="next" href="?page=2">Next</a></nav></body>',
    );
    expect(parseScoreLATAMMexicoScoreboard(paginatedHtml, edition)).toMatchObject({
      status: 'staged',
      reason:
        'ScoreLATAM page has pagination controls; Mexico-group completeness cannot be confirmed.',
      coverage: { rowsComplete: false, paginationComplete: null },
      rows: [],
    });
  });
});
