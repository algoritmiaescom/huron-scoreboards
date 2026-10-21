import { selectSchoolHistory } from './selectors';

import type { ScoreboardsArchive } from '../repositories/scoreboardsRepository';

export const selectSchoolDirectory = (archive: ScoreboardsArchive) =>
  archive.schools
    .map((school) => {
      const scope = school.parentInstitutionId === undefined ? 'institution' : 'school';
      const history = selectSchoolHistory(archive, school.id, scope);
      if (history.status !== 'found') {
        throw new Error(`Unresolved school ${school.id}; directory requires a validated archive.`);
      }
      const { contests, schools } = history.record;
      return {
        school,
        scope,
        units: schools.length - 1,
        results: contests.length,
        contests: new Set(contests.map(({ contest }) => contest.id)).size,
        bestPlace: contests.reduce<number | undefined>(
          (best, { row }) => (best === undefined ? row.place : Math.min(best, row.place)),
          undefined,
        ),
      };
    })
    .sort(
      (a, b) =>
        a.school.shortName.localeCompare(b.school.shortName, 'es') ||
        a.school.id.localeCompare(b.school.id),
    );

export type SchoolSummary = ReturnType<typeof selectSchoolDirectory>[number];

export const filterSchoolDirectory = (summaries: SchoolSummary[], query: string) => {
  const search = query.trim().toLocaleLowerCase('es');
  return summaries.filter(({ school }) =>
    [school.shortName, school.officialName, school.city, school.state]
      .filter((part) => part !== undefined)
      .join(' ')
      .toLocaleLowerCase('es')
      .includes(search),
  );
};
