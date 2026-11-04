import { describe, expect, it } from 'vitest';

import { archive, contest, standing } from '@/test/fixtures/archive';

import { scoreStandingRow, selectFirstSolves } from './scoring';
import {
  selectAccumulatedRows,
  selectCatalog,
  selectContestRows,
  selectFilteredContestRows,
  selectLatestHeldContest,
  selectQualificationCut,
  selectSchoolHistory,
  selectSchoolScope,
  seriesLabel,
} from './selectors';

describe('scoring and joins', () => {
  it('counts only solved results and uses the contest penalty, including zero penalties', () => {
    expect(scoreStandingRow(contest.standings[0], 15)).toEqual({ solved: 1, penalty: 25 });
    expect(scoreStandingRow(contest.standings[0], 0)).toEqual({ solved: 1, penalty: 10 });
    expect(scoreStandingRow(contest.standings[1], 15)).toEqual({ solved: 2, penalty: 60 });
    expect(scoreStandingRow(contest.standings[3], 15)).toEqual({ solved: 0, penalty: 0 });
  });

  it('retains all tied first solvers and leaves unsolved problems without a first solver', () => {
    const first = selectFirstSolves(contest);
    expect(first.get('A')).toEqual(new Set(['2024-a', '2024-b']));
    expect(first.get('B')).toEqual(new Set(['2024-c']));
    expect(first.get('C')).toEqual(new Set());
    expect(selectFirstSolves({ ...contest, standings: [] }).get('A')).toEqual(new Set());
  });

  it('joins season identities without inventing metadata, sorting by official place not derived score', () => {
    const rows = selectContestRows(archive, {
      ...contest,
      standings: [...contest.standings].reverse(),
    });
    expect(rows.map(({ place }) => place)).toEqual([1, 2, 2, 4]);
    expect(rows[0]).toMatchObject({
      team: { name: 'Alpha', seasonYear: 2024 },
      school: { id: 'unit', parentInstitutionId: 'uni' },
      solved: 1,
      penalty: 25,
      firstSolvedLabels: ['A'],
    });
    expect(rows[0].team.members).toBeUndefined();
    expect(rows[0].school?.logo).toBeUndefined();
    expect(contest.standings.map(({ teamId }) => teamId)).toEqual([
      '2024-a',
      '2024-b',
      '2024-c',
      '2024-d',
    ]);
  });

  it('retains a team whose source did not identify its school', () => {
    const contestWithUnknownSchool = { ...contest, standings: [contest.standings[0]] };
    const archiveWithUnknownSchool = {
      ...archive,
      teams: archive.teams.map((team) =>
        team.id === contest.standings[0].teamId ? { ...team, schoolId: null } : team,
      ),
    };

    expect(selectContestRows(archiveWithUnknownSchool, contestWithUnknownSchool)[0].school).toBe(
      null,
    );
    expect(
      selectFilteredContestRows(archiveWithUnknownSchool, contestWithUnknownSchool, {
        school: 'unit',
      }),
    ).toMatchObject({ rows: [] });
  });

  it('fails explicitly if a caller bypasses repository reference validation', () => {
    expect(() => selectContestRows({ ...archive, teams: [] }, contest)).toThrow('Unresolved team');
    expect(() => selectContestRows({ ...archive, schools: [] }, contest)).toThrow(
      'Unresolved school',
    );
  });
});

describe('catalog and selection', () => {
  it('retains undated contests in the catalog but never selects them as latest held', () => {
    const undated = { ...contest, id: 'undated', date: null };
    const partialArchive = { ...archive, contests: [undated, contest] };
    expect(selectCatalog(partialArchive)[0].series[0].contests.map(({ id }) => id)).toEqual([
      contest.id,
      'undated',
    ]);
    expect(selectLatestHeldContest({ ...archive, contests: [undated] }, '2026-01-01')).toEqual({
      status: 'not-found',
    });
  });
  it('discovers sparse seasons, optional stages, standing-only series and open-ended series ids', () => {
    const catalog = selectCatalog({
      ...archive,
      contests: [
        contest,
        {
          ...contest,
          id: '2023-open-final',
          seasonYear: 2023,
          seriesId: 'open-series',
          stage: 'final',
        },
      ],
      seasonStandings: [
        ...archive.seasonStandings,
        { ...standing, seasonYear: 2026, seriesId: 'new-series' },
      ],
    });
    expect(catalog.map(({ seasonYear }) => seasonYear)).toEqual([2026, 2024, 2023]);
    expect(catalog[0].series[0]).toEqual({
      id: 'new-series',
      label: 'new series',
      contests: [],
      accumulated: true,
    });
    expect(catalog[1].series[0].contests).toHaveLength(1);
    expect(catalog[1].series[0].contests[0].stageLabel).toBe('Clasificatoria 1');
    expect(seriesLabel('mexico-finals')).toBe('Final Regional Mexicana');
    expect(selectCatalog({ ...archive, contests: [], seasonStandings: [] })).toEqual([]);
  });

  it('selects only held contests, resolving equal dates by ascending id', () => {
    const selected = selectLatestHeldContest(
      {
        ...archive,
        contests: [
          { ...contest, id: 'z' },
          { ...contest, id: 'a' },
          { ...contest, id: 'future', date: '2024-03-02' },
        ],
      },
      '2024-03-01',
    );
    expect(selected).toMatchObject({ status: 'found', record: { id: 'a' } });
    expect(selectLatestHeldContest(archive, '2024-02-29')).toEqual({ status: 'not-found' });
  });
});

describe('standings filters', () => {
  it('uses published solved counts without inventing problem-specific results', () => {
    const partial = {
      ...contest,
      standings: [
        {
          place: 1,
          teamId: '2024-a',
          results: null,
          publishedTotals: { solved: 1, penalty: null },
        },
      ],
    };
    expect(selectFilteredContestRows(archive, partial, { accepted: true })).toMatchObject({
      rows: [{ solved: 1, penalty: null }],
    });
    expect(
      selectFilteredContestRows(archive, partial, { accepted: true, problem: 'A' }),
    ).toMatchObject({ rows: [] });
    expect(selectFilteredContestRows(archive, partial, { first: true })).toMatchObject({
      rows: [],
    });
  });
  const ids = (filters: Parameters<typeof selectFilteredContestRows>[2]) => {
    const result = selectFilteredContestRows(archive, contest, filters);
    if (result.status !== 'ready') {
      throw new Error('Expected valid filters');
    }
    expect(result.total).toBe(4);
    return result.rows.map(({ teamId }) => teamId);
  };

  it('matches only team names case-insensitively and exact competing schools', () => {
    expect(ids({ team: 'ALP' })).toEqual(['2024-a']);
    expect(ids({ team: 'Unit' })).toEqual([]);
    expect(ids({ school: 'uni' })).toEqual([]);
    expect(ids({ school: 'unit' })).toEqual(['2024-a', '2024-d']);
    expect(ids({ school: 'unused' })).toEqual([]);
  });

  it('scopes solved/first predicates to a problem but does not filter for a problem alone', () => {
    expect(ids({ problem: 'C' })).toHaveLength(4);
    expect(ids({ accepted: true })).toEqual(['2024-a', '2024-b', '2024-c']);
    expect(ids({ accepted: true, problem: 'B' })).toEqual(['2024-b', '2024-c']);
    expect(ids({ first: true, problem: 'A' })).toEqual(['2024-a', '2024-b']);
    expect(ids({ first: true })).toEqual(['2024-a', '2024-b', '2024-c']);
    expect(ids({ first: true, problem: 'C' })).toEqual([]);
  });

  it('combines all filters with AND and never recalculates first solve after filtering', () => {
    expect(ids({ team: 'b', school: 'campus', problem: 'A', accepted: true, first: true })).toEqual(
      ['2024-b'],
    );
    expect(ids({ school: 'campus', problem: 'B', first: true })).toEqual([]);
    const filtered = selectFilteredContestRows(archive, contest, { school: 'solo' });
    expect(filtered).toMatchObject({ rows: [{ place: 2, firstSolvedLabels: ['B'] }] });
  });

  it('returns invalid school/problem selections instead of unrelated standings', () => {
    expect(selectFilteredContestRows(archive, contest, { school: 'missing' })).toEqual({
      status: 'invalid',
      field: 'school',
      value: 'missing',
    });
    expect(selectFilteredContestRows(archive, contest, { problem: 'Z' })).toEqual({
      status: 'invalid',
      field: 'problem',
      value: 'Z',
    });
  });
});

describe('accumulated standing', () => {
  it('never interprets unknown qualification as exclusion or draws a cut through it', () => {
    const partial = {
      ...standing,
      rows: standing.rows.map((row, index) => ({
        ...row,
        qualified: index === 2 ? null : row.qualified,
      })),
    };
    expect(selectQualificationCut(partial)).toBeUndefined();
    expect(selectAccumulatedRows(archive, partial)[2].qualified).toBeNull();
  });
  it('preserves published fractional scores, places and qualification rather than deriving them', () => {
    expect(
      selectAccumulatedRows(archive, standing).map(({ score, place, qualified }) => ({
        score,
        place,
        qualified,
      })),
    ).toEqual(standing.rows.map(({ score, place, qualified }) => ({ score, place, qualified })));
    expect(selectQualificationCut(standing)).toBe(2);
  });

  it('omits a cut for qualified-only, unqualified-only, non-contiguous and shared-place boundaries', () => {
    expect(selectQualificationCut({ ...standing, rows: [] })).toBeUndefined();
    expect(
      selectQualificationCut({ ...standing, rows: standing.rows.slice(0, 2) }),
    ).toBeUndefined();
    expect(
      selectQualificationCut({
        ...standing,
        rows: standing.rows.map((row) => ({ ...row, qualified: false })),
      }),
    ).toBeUndefined();
    expect(
      selectQualificationCut({
        ...standing,
        rows: standing.rows.map((row, index) => ({ ...row, qualified: index % 2 === 0 })),
      }),
    ).toBeUndefined();
    expect(
      selectQualificationCut({
        ...standing,
        rows: standing.rows.map((row, index) => ({ ...row, place: index === 2 ? 2 : row.place })),
      }),
    ).toBeUndefined();
  });
});

describe('institutional history', () => {
  it('keeps accumulated-only seasons without fabricating contest statistics', () => {
    const result = selectSchoolHistory({ ...archive, contests: [] }, 'unit');
    expect(result).toMatchObject({
      status: 'found',
      record: {
        contests: [],
        seasons: [{ seasonYear: 2024, teams: 2, contests: 0, bestPlace: undefined, podiums: 1 }],
      },
    });
  });

  it('keeps unit histories exact by default and rolls up all descendants only explicitly', () => {
    const unit = selectSchoolHistory(archive, 'unit');
    expect(unit).toMatchObject({ status: 'found', record: { scope: 'school' } });
    if (unit.status !== 'found') {
      throw new Error('Expected unit history');
    }
    expect(unit.record.contests.map(({ row }) => row.teamId)).toEqual(['2024-a', '2024-d']);
    expect(unit.record.accumulated.map(({ row }) => row.teamId)).toEqual(['2024-a', '2024-d']);
    expect(selectSchoolHistory(archive, 'uni')).toMatchObject({
      record: { contests: [], seasons: [] },
    });
    const institution = selectSchoolHistory(archive, 'uni', 'institution');
    if (institution.status !== 'found') {
      throw new Error('Expected institutional history');
    }
    expect(institution.record.schools.map(({ id }) => id)).toEqual(['uni', 'unit', 'campus']);
    expect(institution.record.contests.map(({ row }) => row.teamId)).toEqual([
      '2024-a',
      '2024-b',
      '2024-d',
    ]);
    expect(institution.record.seasons).toEqual([
      { seasonYear: 2024, teams: 3, contests: 1, bestPlace: 1, podiums: 4 },
    ]);
    expect(selectSchoolHistory(archive, 'missing')).toEqual({ status: 'not-found' });
    expect(selectSchoolScope(archive, 'solo', 'institution')).toMatchObject({
      record: { schools: [archive.schools[3]] },
    });
  });

  it('does not merge teams with identical names across years or duplicate multiple contest participation', () => {
    const previousTeam = { ...archive.teams[0], id: '2023-a', seasonYear: 2023 };
    const previousContest = {
      ...contest,
      id: '2023-gpm-q1',
      seasonYear: 2023,
      date: '2023-03-01',
      standings: [{ ...contest.standings[0], teamId: previousTeam.id }],
    };
    const result = selectSchoolHistory(
      {
        ...archive,
        teams: [...archive.teams, previousTeam],
        contests: [contest, { ...contest, id: '2024-gpm-q2', date: '2024-04-01' }, previousContest],
      },
      'unit',
    );
    if (result.status !== 'found') {
      throw new Error('Expected unit history');
    }
    expect(result.record.teams).toHaveLength(3);
    expect(result.record.seasons).toEqual([
      { seasonYear: 2023, teams: 1, contests: 1, bestPlace: 1, podiums: 1 },
      { seasonYear: 2024, teams: 2, contests: 2, bestPlace: 1, podiums: 3 },
    ]);
  });
});
