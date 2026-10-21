import { describe, expect, it } from 'vitest';

import { archive, contest, standing } from '@/test/fixtures/archive';

import { filterSchoolDirectory, selectSchoolDirectory } from './schoolDirectory';

describe('school directory summaries', () => {
  it('aggregates institution descendants once and keeps units exact', () => {
    const summaries = selectSchoolDirectory(archive);
    expect(summaries.find(({ school }) => school.id === 'uni')).toMatchObject({
      scope: 'institution',
      units: 2,
      results: 3,
      contests: 1,
      bestPlace: 1,
    });
    expect(summaries.find(({ school }) => school.id === 'unit')).toMatchObject({
      scope: 'school',
      units: 0,
      results: 2,
      contests: 1,
      bestPlace: 1,
    });
    expect(summaries.find(({ school }) => school.id === 'campus')).toMatchObject({
      scope: 'school',
      results: 1,
      contests: 1,
      bestPlace: 2,
    });
    expect(summaries.find(({ school }) => school.id === 'solo')).toMatchObject({
      scope: 'institution',
      units: 0,
      results: 1,
      contests: 1,
      bestPlace: 2,
    });
    expect(summaries.find(({ school }) => school.id === 'unused')).toMatchObject({
      units: 0,
      results: 0,
      contests: 0,
      bestPlace: undefined,
    });
    expect(summaries.map(({ school }) => school.shortName)).toEqual(['C', 'N', 'S', 'UNI', 'UNIT']);
  });

  it('includes direct parent results and does not count accumulation or registrations as contest results', () => {
    const parentTeam = { id: '2024-parent', name: 'Direct', schoolId: 'uni', seasonYear: 2024 };
    const source = {
      ...archive,
      teams: [
        ...archive.teams,
        parentTeam,
        { ...parentTeam, id: 'unused-team', schoolId: 'unused' },
      ],
      contests: [
        contest,
        {
          ...contest,
          id: 'other',
          standings: [
            {
              place: 8,
              teamId: parentTeam.id,
              results: contest.problems.map(() => ({ status: 'unattempted' as const })),
            },
          ],
        },
      ],
    };
    expect(selectSchoolDirectory(source).find(({ school }) => school.id === 'uni')).toMatchObject({
      results: 4,
      contests: 2,
      bestPlace: 1,
    });
    expect(
      selectSchoolDirectory(source).find(({ school }) => school.id === 'unused'),
    ).toMatchObject({ results: 0 });
    const accumulatedOnly = { ...archive, contests: [], seasonStandings: [standing] };
    expect(
      selectSchoolDirectory(accumulatedOnly).every(
        ({ results, bestPlace }) => results === 0 && bestPlace === undefined,
      ),
    ).toBe(true);
  });

  it('searches official/short names and optional location, not missing-value strings', () => {
    const summaries = selectSchoolDirectory({
      ...archive,
      schools: archive.schools.map((school) =>
        school.id === 'solo' ? { ...school, city: 'Mérida', state: 'Yucatán' } : school,
      ),
    });
    for (const query of ['Standalone', ' s ', 'MÉRIDA', 'yucatán']) {
      expect(
        filterSchoolDirectory(summaries, query).some(({ school }) => school.id === 'solo'),
      ).toBe(true);
    }
    expect(filterSchoolDirectory(summaries, 'undefined')).toEqual([]);
    expect(filterSchoolDirectory(summaries, 'missing')).toEqual([]);
    expect(filterSchoolDirectory(summaries, '  ')).toEqual(summaries);
    expect(
      selectSchoolDirectory({
        ...archive,
        schools: [],
        teams: [],
        contests: [],
        seasonStandings: [],
      }),
    ).toEqual([]);
  });
});
