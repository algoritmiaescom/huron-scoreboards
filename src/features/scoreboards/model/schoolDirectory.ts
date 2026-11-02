import type { ScoreboardsArchive } from '../repositories/scoreboardsRepository';

export const selectSchoolDirectory = (archive: ScoreboardsArchive) => {
  const schoolsById = new Map(archive.schools.map((school) => [school.id, school]));
  const summaries = new Map(
    archive.schools.map((school) => [
      school.id,
      {
        school,
        scope:
          school.parentInstitutionId === undefined ? ('institution' as const) : ('school' as const),
        units: 0,
        results: 0,
        contestIds: new Set<string>(),
        bestPlace: undefined as number | undefined,
      },
    ]),
  );
  const teamsById = new Map(archive.teams.map((team) => [team.id, team]));

  archive.schools.forEach((school) => {
    let parentId = school.parentInstitutionId;
    while (parentId !== undefined) {
      const parentSummary = summaries.get(parentId);
      const parentSchool = schoolsById.get(parentId);
      if (parentSummary === undefined || parentSchool === undefined) {
        throw new Error(
          `Unresolved parent institution ${parentId}; directory requires a validated archive.`,
        );
      }
      if (parentSummary.scope === 'institution') {
        parentSummary.units += 1;
      }
      parentId = parentSchool.parentInstitutionId;
    }
  });

  const addResult = (
    summary: NonNullable<ReturnType<typeof summaries.get>>,
    contestId: string,
    place: number | null,
  ) => {
    summary.results += 1;
    summary.contestIds.add(contestId);
    if (place !== null) {
      summary.bestPlace =
        summary.bestPlace === undefined ? place : Math.min(summary.bestPlace, place);
    }
  };

  archive.contests.forEach((contest) => {
    contest.standings.forEach((row) => {
      const team = teamsById.get(row.teamId);
      if (team === undefined) {
        throw new Error(`Unresolved team ${row.teamId}; directory requires a validated archive.`);
      }
      let schoolId = team.schoolId;
      const teamSchoolId = schoolId;
      while (schoolId !== null) {
        const summary = summaries.get(schoolId);
        const school = schoolsById.get(schoolId);
        if (summary === undefined || school === undefined) {
          throw new Error(`Unresolved school ${schoolId}; directory requires a validated archive.`);
        }
        if (schoolId === teamSchoolId || summary.scope === 'institution') {
          addResult(summary, contest.id, row.place);
        }
        schoolId = school.parentInstitutionId ?? null;
      }
    });
  });

  return [...summaries.values()]
    .map(({ contestIds, ...summary }) => ({ ...summary, contests: contestIds.size }))
    .sort(
      (a, b) =>
        a.school.shortName.localeCompare(b.school.shortName, 'es') ||
        a.school.id.localeCompare(b.school.id),
    );
};

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
