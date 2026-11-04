import { describe, expect, it } from 'vitest';

import { archive, contest } from '@/test/fixtures/archive';

import { selectSchoolHistoryPresentation } from './schoolHistory';
import {
  hasInvalidSchoolHistoryParams,
  selectSchoolAccumulatedResults,
  selectSchoolResults,
} from './schoolResultsFilters';

const selection = selectSchoolHistoryPresentation(archive, 'unit', 'school');
if (selection.status !== 'found') throw new Error('Expected unit history');
const rows = selection.record.contests;
const ids = (params: string) =>
  selectSchoolResults(rows, new URLSearchParams(params)).map(({ row }) => row.teamId);

describe('school result controls', () => {
  it('preserves newest-first default and filters only matching team-season rows', () => {
    expect(ids('')).toEqual(['2024-d', '2024-a']);
    expect(ids('team=%20aLpHa%20&season=2024')).toEqual(['2024-a']);
    expect(ids('team=missing')).toEqual([]);
    expect(ids('season=2023')).toEqual([]);
    expect(rows).toHaveLength(2);
  });

  it('sorts by published place, team name or solved totals', () => {
    for (const sort of ['place', 'team', 'solved']) {
      expect(ids(`sort=${sort}`)).toEqual(['2024-a', '2024-d']);
    }
  });

  it('keeps unknown places last and uses newest-first order for ties', () => {
    const unknown = { ...rows[0], row: { ...rows[0].row, place: null } };
    const known = { ...rows[1], row: { ...rows[1].row, place: 2 } };
    expect(
      selectSchoolResults([known, unknown], new URLSearchParams('sort=place')).map(
        ({ row }) => row.place,
      ),
    ).toEqual([2, null]);
    const tied = { ...rows[0], row: { ...rows[0].row, place: 2 } };
    expect(
      selectSchoolResults([tied, known], new URLSearchParams('sort=place')).map(
        ({ row }) => row.teamId,
      ),
    ).toEqual(['2024-d', '2024-a']);
  });

  it('keeps later seasons ahead of older ones and allows season-only filtering', () => {
    const previous = {
      ...rows[0],
      contest: { ...contest, id: '2023-gpm-q1', seasonYear: 2023 },
    };
    expect(
      selectSchoolResults([previous, ...rows], new URLSearchParams()).map(
        ({ contest: entry }) => entry.seasonYear,
      ),
    ).toEqual([2024, 2024, 2023]);
    expect(selectSchoolResults([previous, ...rows], new URLSearchParams('season=2023'))).toEqual([
      previous,
    ]);
  });

  it.each([
    'scope=unknown',
    'scope=school&scope=institution',
    'team=a&team=b',
    'season=2024&season=2025',
    'sort=place&sort=team',
    'season=invalid',
    'season=',
    'sort=invalid',
    'q=unknown',
    'series=unknown',
    'series=gpm-qualifiers&series=mexico-finals',
    'tab=unknown',
    'tab=seasons&tab=contests',
    'accumulatedTeam=a&accumulatedTeam=b',
    'accumulatedSeason=2024&accumulatedSeason=2025',
    'accumulatedSeason=invalid',
    'accumulatedSort=place&accumulatedSort=score',
    'accumulatedSort=solved',
  ])('rejects invalid parameters: %s', (query) => {
    expect(hasInvalidSchoolHistoryParams(new URLSearchParams(query))).toBe(true);
  });

  it('accepts supported, optional parameters together', () => {
    expect(hasInvalidSchoolHistoryParams(new URLSearchParams())).toBe(false);
    expect(
      hasInvalidSchoolHistoryParams(
        new URLSearchParams(
          'scope=school&season=2024&team=Alpha&sort=solved&accumulatedTeam=Delta&accumulatedSeason=2023&accumulatedSort=score',
        ),
      ),
    ).toBe(false);
  });

  describe('school accumulated result controls', () => {
    const accumulated = selection.record.accumulated;
    const previous = {
      ...accumulated[0],
      standing: { ...accumulated[0].standing, seasonYear: 2023 },
      row: { ...accumulated[0].row, place: 2, score: 100 },
    };
    const entries = [previous, ...accumulated];

    it('defaults to newest first, preserving published order within each season', () => {
      expect(selectSchoolAccumulatedResults(entries, new URLSearchParams())).toEqual([
        ...accumulated,
        previous,
      ]);
      expect(entries[0]).toBe(previous);
    });

    it('filters by trimmed case-insensitive team and season independently of contest filters', () => {
      expect(
        selectSchoolAccumulatedResults(
          entries,
          new URLSearchParams(
            'accumulatedTeam=%20aLpHa%20&accumulatedSeason=2024&team=Delta&season=2023&sort=solved',
          ),
        ),
      ).toEqual([accumulated[0]]);
      expect(
        selectSchoolAccumulatedResults(entries, new URLSearchParams('accumulatedTeam=missing')),
      ).toEqual([]);
      expect(
        selectSchoolAccumulatedResults(entries, new URLSearchParams('accumulatedSeason=2000')),
      ).toEqual([]);
      expect(
        selectSchoolResults(rows, new URLSearchParams('accumulatedTeam=missing')),
      ).toHaveLength(2);
    });

    it('sorts by place, name and score with newest-first tie breaking', () => {
      expect(
        selectSchoolAccumulatedResults(entries, new URLSearchParams('accumulatedSort=place')),
      ).toEqual([accumulated[0], previous, accumulated[1]]);
      expect(
        selectSchoolAccumulatedResults(entries, new URLSearchParams('accumulatedSort=team')),
      ).toEqual([accumulated[0], previous, accumulated[1]]);
      expect(
        selectSchoolAccumulatedResults(entries, new URLSearchParams('accumulatedSort=score')),
      ).toEqual([previous, ...accumulated]);
      const tied = {
        ...previous,
        row: { ...previous.row, score: accumulated[0].row.score, place: accumulated[0].row.place },
      };
      for (const sort of ['score', 'place']) {
        expect(
          selectSchoolAccumulatedResults(
            [tied, accumulated[0]],
            new URLSearchParams(`accumulatedSort=${sort}`),
          ),
        ).toEqual([accumulated[0], tied]);
      }
    });
  });
});
