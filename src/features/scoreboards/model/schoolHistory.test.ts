import { describe, expect, it } from 'vitest';

import { archive, contest, partialContest, standing } from '@/test/fixtures/archive';

import { selectSchoolHistoryPresentation } from './schoolHistory';

describe('school history presentation selectors', () => {
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
  it('separates contest statistics from published accumulated rows', () => {
    const result = selectSchoolHistoryPresentation(archive, 'uni', 'institution');
    expect(result.status).toBe('found');
    if (result.status !== 'found') {
      throw new Error('Expected institution history');
    }
    expect(result.record.summary).toEqual({
      results: 3,
      contests: 1,
      teams: 3,
      podiums: 2,
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
    expect(result.record.seasons[0].podiums).toHaveLength(2);
    expect(result.record.podiums).toHaveLength(2);
    expect(result.record.accumulated).toHaveLength(3);
    expect(result.record.summary.results).toBe(3);
    expect(result.record.summary.podiums).toBe(2);
  });

  it('supports single-season, tied places and no-result schools without fake best places', () => {
    const unit = selectSchoolHistoryPresentation(archive, 'unit', 'school');
    expect(unit.status).toBe('found');
    if (unit.status === 'found') {
      expect(unit.record.seasons).toHaveLength(1);
      expect(unit.record.seasons[0].podiums.map(({ row }) => row.place)).toEqual([1]);
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
      expect(result.record.seasons).toEqual([]);
      expect(result.record.accumulated).toHaveLength(2);
    }
    expect(selectSchoolHistoryPresentation(archive, 'missing', 'school')).toEqual({
      status: 'not-found',
    });
  });

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
