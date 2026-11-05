// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { createJsonScoreboardsRepository } from './scoreboardsRepository';

const files = import.meta.glob<string>(['/data/**/*.json', '!/data/mock/**/*.json'], {
  query: '?raw',
  import: 'default',
});

describe('published historical archive', () => {
  it('keeps only participating schools and required parents without excluding zero-score results', async () => {
    const result = await createJsonScoreboardsRepository(files, 'archive').load();
    if (result.status !== 'ready') {
      throw new Error('Historical archive did not pass repository validation.');
    }
    const { schools, teams, contests, seasonStandings } = result.data;
    const byTeam = new Map(teams.map((team) => [team.id, team]));
    const bySchool = new Map(schools.map((school) => [school.id, school]));
    const rows = [
      ...contests.flatMap(({ standings }) => standings),
      ...seasonStandings.flatMap(({ rows }) => rows),
    ];
    const participatingSchools = new Set(
      rows
        .map(({ teamId }) => byTeam.get(teamId)?.schoolId)
        .filter((schoolId): schoolId is string => schoolId !== undefined && schoolId !== null),
    );
    const requiredSchools = new Set(participatingSchools);
    for (const id of participatingSchools) {
      let parent = bySchool.get(id)?.parentInstitutionId;
      while (parent !== undefined) {
        requiredSchools.add(parent);
        parent = bySchool.get(parent)?.parentInstitutionId;
      }
    }
    expect(participatingSchools.size).toBe(871);
    expect(schools).toHaveLength(875);
    expect(new Set(schools.map(({ id }) => id))).toEqual(requiredSchools);
    expect(schools.filter(({ id }) => !participatingSchools.has(id)).map(({ id }) => id)).toEqual([
      'ipn',
      'itesm',
      'unlp',
      'up',
    ]);
    expect(teams).toHaveLength(17221);
    for (const id of ['cujae', 'eafit', 'iteso-preparatoria']) {
      expect(bySchool.has(id)).toBe(false);
      expect(teams.some(({ schoolId }) => schoolId === id)).toBe(false);
    }
    for (const id of ['ifpb', 'it-cd-jimenez', 'itsav']) {
      expect(participatingSchools.has(id)).toBe(true);
    }
    expect(
      contests
        .flatMap(({ standings }) => standings)
        .some(
          (row) => byTeam.get(row.teamId)?.schoolId === 'ifpb' && row.publishedTotals?.solved === 0,
        ),
    ).toBe(true);
    expect(
      seasonStandings
        .flatMap(({ rows }) => rows)
        .some(
          (row) =>
            byTeam.get(row.teamId)?.schoolId === 'source-school-254fc4ed9920' && row.score === 0,
        ),
    ).toBe(true);
  });

  it('loads every recovered accumulated document and historical Finals through the repository boundary', async () => {
    const result = await createJsonScoreboardsRepository(files, 'archive').load();
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') {
      throw new Error('Historical archive did not pass repository validation.');
    }
    const { contests, seasonStandings, teams, schools } = result.data;
    const branded = schools.filter(({ logo }) => logo !== undefined);
    expect(branded).toHaveLength(61);
    expect(branded.every(({ logo }) => logo?.startsWith('https://'))).toBe(true);
    for (const id of ['itl', 'itsur', 'itnl', 'ug-cimat', 'ccl']) {
      expect(schools.find((school) => school.id === id)?.logo).toBeUndefined();
    }
    for (const [canonical, alias] of [
      ['iteso', 'source-label-iteso-university-f66d759f69'],
      ['uaslp', 'source-label-universidad-autonoma-de-san-luis-potosi-90a8e47bc9'],
      ['tec-costa-rica-alajuela', 'source-school-d172e86ae35a'],
      ['uaz', 'source-label-universidad-autonoma-de-zacatecas-258b87c15e'],
      ['tecnm-its-lerdo', 'source-label-instituto-tecnologico-superior-de-lerdo-5eca1aae76'],
    ]) {
      expect(schools.find(({ id }) => id === canonical)?.logo).toBe(
        schools.find(({ id }) => id === alias)?.logo,
      );
    }
    for (const id of ['itesm', 'ipn', 'unam', 'udg', 'up']) {
      expect(schools.find((school) => school.id === id)?.logo).toMatch(/^https:\/\//);
    }
    expect(contests).toHaveLength(34);
    expect(contests.reduce((sum, contest) => sum + contest.standings.length, 0)).toBe(12374);
    const qualifiers = contests.filter(({ seasonYear }) => seasonYear === 2026);
    expect(
      qualifiers.map(({ stage, standings, date }) => ({ stage, rows: standings.length, date })),
    ).toEqual([
      { stage: 'qualifier-1', rows: 601, date: '2026-04-18' },
      { stage: 'qualifier-2', rows: 701, date: '2026-05-16' },
      { stage: 'qualifier-3', rows: 610, date: '2026-08-29' },
    ]);
    expect(qualifiers[2].problems).toEqual([]);
    expect(qualifiers[2].standings.every(({ results }) => results === null)).toBe(true);
    expect(qualifiers[2].publicationNotes?.join(' ')).toContain('no se puede confirmar');
    expect(seasonStandings.map(({ seasonYear }) => seasonYear)).toEqual([
      2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015,
    ]);
    expect(seasonStandings.map(({ rows }) => rows.length)).toEqual([
      614, 532, 482, 458, 381, 225, 350, 382, 393, 404, 273, 306,
    ]);
    expect(
      seasonStandings
        .filter(({ seasonYear }) => seasonYear < 2026)
        .every(({ rows }) => rows.every(({ qualified }) => qualified === null)),
    ).toBe(true);

    const accumulated2026 = seasonStandings.find(({ seasonYear }) => seasonYear === 2026);
    expect(accumulated2026?.source).toBe('https://www.icpcmexico.org/contests/gpmx-2026/acumulado');
    expect(accumulated2026?.snapshot).toBe('unconfirmed');
    expect(accumulated2026?.snapshotLabel).toContain('tres fechas');
    expect(accumulated2026?.rows.filter(({ score }) => score > 0)).toHaveLength(509);
    expect(accumulated2026?.rows.filter(({ score }) => score === 0)).toHaveLength(105);
    expect(accumulated2026?.rows.filter(({ place }) => place === 510)).toHaveLength(105);
    expect(accumulated2026?.rows.filter(({ qualified }) => qualified === true)).toHaveLength(70);
    expect(accumulated2026?.rows.filter(({ qualified }) => qualified === null)).toHaveLength(544);
    expect(accumulated2026?.publicationNotes?.join(' ')).toContain('71 cupos');
    expect(accumulated2026?.rows.slice(0, 3).map(({ score }) => score)).toEqual([435, 425, 425]);
    const leader2026 = teams.find(({ id }) => id === accumulated2026?.rows[0].teamId);
    expect(leader2026?.name).toBe('🇲🇽 Oasis');

    const dense = seasonStandings.find(({ seasonYear }) => seasonYear === 2015);
    expect(dense?.ranking).toBe('dense');
    expect(dense?.rows.filter(({ place }) => place === 239)).toHaveLength(51);
    const repeated2015 = dense?.rows.filter(
      ({ teamId }) => teams.find(({ id }) => id === teamId)?.name === 'FGZ',
    );
    expect(repeated2015).toHaveLength(2);
    expect(new Set(repeated2015?.map(({ teamId }) => teamId)).size).toBe(2);

    const standing2024 = seasonStandings.find(({ seasonYear }) => seasonYear === 2024);
    for (const name of ['GooseFarmers', 'Timbits']) {
      const repeated = standing2024?.rows.filter(
        ({ teamId }) => teams.find(({ id }) => id === teamId)?.name === name,
      );
      expect(repeated).toHaveLength(2);
      expect(new Set(repeated?.map(({ teamId }) => teamId)).size).toBe(2);
    }
    const intermediate = seasonStandings.find(({ seasonYear }) => seasonYear === 2023);
    expect(intermediate?.snapshot).toBe('intermediate');
    expect(intermediate?.snapshotLabel).toContain('segunda fecha');
    const partial = contests.find(({ id }) => id === '2013-mexico-finals-final');
    expect(partial?.ranking).toBe('published');
    expect(partial?.publicationNotes?.join(' ')).toContain('puesto 13');
    expect(partial?.standings).toHaveLength(174);
    expect(partial?.standings.filter(({ place }) => place === null)).toHaveLength(81);
    expect(partial?.standings.some(({ place }) => place === 13)).toBe(false);
    for (const [year, count] of [
      [2019, 53],
      [2020, 57],
      [2021, 52],
      [2022, 55],
      [2023, 55],
      [2024, 116],
      [2025, 133],
    ]) {
      const finals = contests.find(({ id }) => id === `${String(year)}-mexico-finals-final`);
      expect(finals?.standings).toHaveLength(count);
      expect(finals?.source).toBe(`https://scorelatam.naquadah.com.br/latam-${String(year)}/`);
      expect(finals?.publicationNotes?.join(' ')).toContain('país MX');
      expect(finals?.publicationNotes?.join(' ')).toContain('excluye las clasificaciones CCL');
      expect(finals?.standings[0].place).toBe(1);
      expect(finals?.standings.every(({ teamId }) => teams.some(({ id }) => id === teamId))).toBe(
        true,
      );
    }
    const finals2019 = contests.find(
      ({ seasonYear, seriesId }) => seasonYear === 2019 && seriesId === 'mexico-finals',
    );
    expect(teams.find(({ id }) => id === finals2019?.standings[0].teamId)?.name).toBe(
      'Norman is Hunting',
    );
    expect(
      finals2019?.standings.some(
        ({ teamId }) => teams.find(({ id }) => id === teamId)?.name === 'Time com T',
      ),
    ).toBe(false);
    for (const year of [2020, 2021]) {
      expect(
        contests
          .find(({ seasonYear, seriesId }) => seasonYear === year && seriesId === 'mexico-finals')
          ?.publicationNotes?.join(' '),
      ).toContain('Se verificaron todos los equipos');
    }
    expect(
      contests
        .find(({ id }) => id === '2023-mexico-finals-final')
        ?.standings.filter(({ results }) => results === null),
    ).toHaveLength(3);
    expect(
      contests
        .find(({ id }) => id === '2024-mexico-finals-final')
        ?.standings.filter(({ results }) => results === null),
    ).toHaveLength(1);
    expect(
      contests
        .find(({ id }) => id === '2025-mexico-finals-final')
        ?.standings.filter(({ results }) => results === null),
    ).toHaveLength(3);
  });
});
