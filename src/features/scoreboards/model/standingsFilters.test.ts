import { describe, expect, it } from 'vitest';

import { archive, contest } from '@/test/fixtures/archive';

import { resolveScoreboardSelection } from './scoreboardSelection';
import {
  clearStandingsFilters,
  parseStandingsFilters,
  updateStandingsFilter,
} from './standingsFilters';

describe('standings URL contract', () => {
  it('parses all filters without inventing booleans and round-trips encoded team names', () => {
    const params = new URLSearchParams('contest=2024-gpm-q1');
    const next = updateStandingsFilter(params, 'team', 'Álpha & +/#?');
    next.set('school', 'unit');
    next.set('problem', 'A');
    next.set('accepted', '1');
    next.set('first', '1');
    expect(parseStandingsFilters(new URLSearchParams(next.toString()), archive, contest)).toEqual({
      filters: { team: 'Álpha & +/#?', school: 'unit', problem: 'A', accepted: true, first: true },
      issues: [],
    });
    expect(params.toString()).toBe('contest=2024-gpm-q1');
    expect(resolveScoreboardSelection(archive, next, '2024-03-01')).toEqual({
      status: 'selected',
      contest,
    });
  });

  it.each([
    'accepted=0',
    'accepted=true',
    'accepted=',
    'first=false',
    'first=2',
    'school=missing',
    'school=',
    'problem=Z',
    'problem=',
  ])('explains invalid filters instead of coercing them: %s', (query) => {
    const parsed = parseStandingsFilters(new URLSearchParams(query), archive, contest);
    expect(parsed.issues).toHaveLength(1);
    expect(parsed.filters).toEqual({});
  });

  it('rejects repeated filters even when the values agree, without losing valid parameters', () => {
    expect(
      parseStandingsFilters(new URLSearchParams('first=1&first=1&team=Alpha'), archive, contest),
    ).toEqual({
      filters: { team: 'Alpha' },
      issues: [{ key: 'first', message: 'El filtro "first" está repetido.' }],
    });
    const params = new URLSearchParams('contest=2024-gpm-q1&problem=A&problem=B&team=Alpha');
    expect(resolveScoreboardSelection(archive, params, '2024-03-01').status).toBe('selected');
    expect(updateStandingsFilter(params, 'problem', '').toString()).toBe(
      'contest=2024-gpm-q1&team=Alpha',
    );
    expect(clearStandingsFilters(params).toString()).toBe('contest=2024-gpm-q1');
  });

  it('keeps exact nonparticipating schools valid and empty team text unfiltered', () => {
    expect(
      parseStandingsFilters(new URLSearchParams('team=&school=unused'), archive, contest),
    ).toEqual({
      filters: { school: 'unused' },
      issues: [],
    });
  });

  it.each(['contest=missing', 'contest=', 'contest=a&contest=b', 'unknown=1'])(
    'rejects invalid selections: %s',
    (query) => {
      expect(
        resolveScoreboardSelection(archive, new URLSearchParams(query), '2024-03-01').status,
      ).toBe('invalid');
    },
  );

  it('resolves accumulated routes separately and handles absent held contests', () => {
    expect(
      resolveScoreboardSelection(
        archive,
        new URLSearchParams('season=2024&series=gpm&view=accumulated'),
        '2024-03-01',
      ).status,
    ).toBe('accumulated');
    expect(resolveScoreboardSelection(archive, new URLSearchParams(), '2024-02-01')).toEqual({
      status: 'empty',
    });
  });
});
