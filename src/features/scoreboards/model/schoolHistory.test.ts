import { describe, expect, it } from 'vitest';

import { archive, contest, partialContest, standing } from '@/test/fixtures/archive';

import { selectSchoolHistoryPresentation } from './schoolHistory';

describe('school history presentation selectors', () => {
  it('counts unranked results without creating a best place or podium', () => {
    const source = {
      ...archive,
      contests: [
        { ...contest, standings: contest.standings.map((row) => ({ ...row, place: null })) },
      ],
      seasonStandings: [],
    };
    const result = selectSchoolHistoryPresentation(source, 'unit', 'school');
    expect(result).toMatchObject({
      status: 'found',
      record: {
        summary: { results: 2, bestPlace: undefined, podiums: 0 },
        seasons: [{ bestPlace: undefined, podiums: [] }],
        podiums: [],
      },
    });
  });

  it('preserves undated totals-only results in season summaries without inventing problem detail', () => {
    const result = selectSchoolHistoryPresentation(
      { ...archive, contests: [partialContest] },
      'unit',
      'school',
    );
    expect(result).toMatchObject({
      status: 'found',
      record: {
        seasons: [{ seasonYear: 2024, solved: 1, results: 2 }],
        contests: [
          { contest: { date: null }, row: { results: null, solved: 1, penalty: null } },
          {},
        ],
      },
    });
  });
  it('includes accumulated podiums without inflating contest statistics', () => {
    const result = selectSchoolHistoryPresentation(archive, 'uni', 'institution');
    expect(result.status).toBe('found');
    if (result.status !== 'found') {
      throw new Error('Expected institution history');
    }
    expect(result.record.summary).toEqual({
      results: 3,
      contests: 1,
      teams: 3,
      podiums: 4,
      bestPlace: 1,
    });
    expect(result.record.seasons).toHaveLength(1);
    expect(result.record.seasons[0]).toMatchObject({
      seasonYear: 2024,
      results: 3,
      contests: 1,
      teams: 3,
      solved: 3,
      bestPlace: 1,
    });
    expect(result.record.seasons[0].podiums).toHaveLength(4);
    expect(result.record.podiums).toHaveLength(4);
    expect(result.record.accumulated).toHaveLength(3);
    expect(result.record.summary.results).toBe(3);
    expect(result.record.summary.podiums).toBe(4);
  });

  it('supports single-season, tied places and no-result schools without fake best places', () => {
    const unit = selectSchoolHistoryPresentation(archive, 'unit', 'school');
    expect(unit.status).toBe('found');
    if (unit.status === 'found') {
      expect(unit.record.seasons).toHaveLength(1);
      expect(unit.record.seasons[0].podiums.map(({ row }) => row.place)).toEqual([1, 1]);
      expect(unit.record.summary.bestPlace).toBe(1);
    }
    const empty = selectSchoolHistoryPresentation(archive, 'unused', 'school');
    expect(empty.status).toBe('found');
    if (empty.status === 'found') {
      expect(empty.record.summary).toEqual({
        results: 0,
        contests: 0,
        teams: 0,
        podiums: 0,
        bestPlace: undefined,
      });
      expect(empty.record.seasons).toEqual([]);
    }
  });

  it('handles accumulated-only seasons separately from contest trends', () => {
    const source = { ...archive, contests: [], seasonStandings: [standing] };
    const result = selectSchoolHistoryPresentation(source, 'unit', 'school');
    expect(result.status).toBe('found');
    if (result.status === 'found') {
      expect(result.record.summary.results).toBe(0);
      expect(result.record.summary.bestPlace).toBeUndefined();
      expect(result.record.summary.podiums).toBe(1);
      expect(result.record.seasons).toMatchObject([
        { seasonYear: 2024, results: 0, contests: 0, teams: 0, bestPlace: undefined },
      ]);
      expect(result.record.seasons[0].podiums).toHaveLength(1);
      expect(result.record.accumulated).toHaveLength(2);
    }
    expect(selectSchoolHistoryPresentation(archive, 'missing', 'school')).toEqual({
      status: 'not-found',
    });
  });

  it('counts qualifiers, Mexico Finals and tied accumulated podiums once per published row', () => {
    const finals = {
      ...contest,
      id: '2024-mexico-finals',
      seriesId: 'mexico-finals',
      stage: 'final' as const,
      name: 'Final México',
      standings: contest.standings.map((row) => ({
        ...row,
        place: row.teamId === '2024-a' ? 3 : 4,
      })),
    };
    const accumulated = {
      ...standing,
      rows: standing.rows.map((row) => ({
        ...row,
        place: row.teamId === '2024-a' || row.teamId === '2024-d' ? 3 : 4,
      })),
    };
    const result = selectSchoolHistoryPresentation(
      { ...archive, contests: [contest, finals], seasonStandings: [accumulated] },
      'unit',
      'school',
    );
    if (result.status !== 'found') {
      throw new Error('Expected unit history');
    }
    expect(result.record.summary).toEqual({
      results: 4,
      contests: 2,
      teams: 2,
      bestPlace: 1,
      podiums: 4,
    });
    expect(result.record.seasons[0].podiums).toHaveLength(4);
    expect(result.record.podiums.map(({ name, row }) => [name, row.teamId, row.place])).toEqual([
      ['Contest', '2024-a', 1],
      ['Final México', '2024-a', 3],
      ['GPM 2024 · Clasificación acumulada', '2024-a', 3],
      ['GPM 2024 · Clasificación acumulada', '2024-d', 3],
    ]);
    expect(new Set(result.record.podiums.map(({ key }) => key)).size).toBe(4);
  });

  it.each([
    ['intermediate', 'resultado intermedio'],
    ['unconfirmed', 'no confirmado como final'],
    ['latest-explicit', undefined],
  ] as const)(
    'retains the %s accumulated snapshot caveat on podium highlights',
    (snapshot, notice) => {
      const result = selectSchoolHistoryPresentation(
        {
          ...archive,
          contests: [],
          seasonStandings: [{ ...standing, snapshot, snapshotLabel: 'Acumulado publicado' }],
        },
        'unit',
        'school',
      );
      if (result.status !== 'found') {
        throw new Error('Expected unit history');
      }
      const podium = result.record.podiums[0];
      expect(podium.href).toBe('/scoreboards?season=2024&series=gpm&view=accumulated');
      if (notice === undefined) {
        expect(podium.notice).toBeUndefined();
      } else {
        expect(podium.notice).toContain('Acumulado publicado');
        expect(podium.notice).toContain(notice);
      }
    },
  );
  it('groups season trends and contest podium rows using published places', () => {
    const previousTeam = { ...archive.teams[0], id: '2023-alpha', seasonYear: 2023 };
    const previous = {
      ...contest,
      id: '2023-gpm-q1',
      seasonYear: 2023,
      date: '2023-03-01',
      standings: [{ ...contest.standings[0], teamId: previousTeam.id, place: 4 }],
    };
    const result = selectSchoolHistoryPresentation(
      { ...archive, teams: [...archive.teams, previousTeam], contests: [contest, previous] },
      'unit',
      'school',
    );
    expect(result.status).toBe('found');
    if (result.status === 'found') {
      expect(
        result.record.seasons.map(({ seasonYear, bestPlace, results }) => ({
          seasonYear,
          bestPlace,
          results,
        })),
      ).toEqual([
        { seasonYear: 2023, bestPlace: 4, results: 1 },
        { seasonYear: 2024, bestPlace: 1, results: 2 },
      ]);
    }
  });
});
