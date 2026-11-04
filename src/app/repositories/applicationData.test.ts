import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createJsonMediaRepository, selectEvent } from '@/features/media';
import {
  createJsonScoreboardsRepository,
  selectContest,
  selectSeasonStanding,
} from '@/features/scoreboards';
import { selectSchoolHistory, selectSchoolScope } from '@/features/scoreboards/model/selectors';
import { mexicoCityDate } from '@/lib/dates';
import {
  archive,
  archiveFiles,
  contest,
  eventFile,
  jsonFile,
  partialContest,
  partialStanding,
} from '@/test/fixtures/archive';

import {
  createApplicationRepositories,
  loadApplicationData,
  loadApplicationRepositories,
  selectLatestFeed,
} from './applicationData';

beforeEach(() => {
  vi.stubEnv('VITE_DATA_SOURCE', undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('runtime repositories', () => {
  it('consolidates explicit Panamericana campuses without assigning ambiguous UP registrations', async () => {
    const files = import.meta.glob<string>(['/data/**/*.json', '!/data/mock/**/*.json'], {
      query: '?raw',
      import: 'default',
    });
    const result = await createJsonScoreboardsRepository(files, 'archive').load();
    if (result.status !== 'ready') {
      throw new Error('Expected a valid published archive');
    }
    const published = result.data;
    const institution = selectSchoolScope(published, 'up', 'institution');
    const direct = selectSchoolScope(published, 'up', 'school');
    if (institution.status !== 'found' || direct.status !== 'found') {
      throw new Error('Expected Panamericana institutional and direct scopes');
    }
    expect(institution.record.school).toEqual({
      id: 'up',
      officialName: 'Universidad Panamericana',
      shortName: 'UP',
    });
    expect(institution.record.schools).toHaveLength(4);
    expect(institution.record.teams).toHaveLength(568);
    expect(direct.record.teams).toHaveLength(0);
    for (const [id, shortName, count, historicalTeam] of [
      ['up-aguascalientes', 'UP Bonaterra', 306, '2009-mexico-finals-global-row-0052-qwerty'],
      ['up-guadalajara', 'UP Guadalajara', 247, '2021-gpm-iteso-555399-mojibake-upgdl'],
      ['up-ciudad-de-mexico', 'UP CDMX', 15, '2015-gpm-iteso-row-0202-upm2'],
    ] as const) {
      const unit = selectSchoolScope(published, id, 'school');
      if (unit.status !== 'found') {
        throw new Error(`Expected Panamericana campus ${id}`);
      }
      expect(unit.record.school.parentInstitutionId).toBe('up');
      expect(unit.record.school.shortName).toBe(shortName);
      expect(unit.record.teams).toHaveLength(count);
      expect(unit.record.teams.map((team) => team.id)).toContain(historicalTeam);
    }
    for (const id of [
      'source-label-universidad-panamericana-campus-bonaterra-d3efb4189f',
      'source-label-up-bonaterra-8c52d5b992',
      'source-school-aa2a43de1753',
      'source-school-f00f1f3e2d58',
      'source-label-universidad-panamericana-campus-guadalajara-9fe3f527a0',
      'source-school-51b132f7b9a7',
      'source-school-b4d27b58e7e2',
      'source-school-91f6e4436bd9',
      'source-school-5b30fd95c616',
    ]) {
      expect(published.schools.some((school) => school.id === id)).toBe(false);
      expect(published.teams.some((team) => team.schoolId === id)).toBe(false);
    }
    expect(published.schools.find(({ id }) => id === 'source-label-up-42cb4e6f84')).toEqual({
      id: 'source-label-up-42cb4e6f84',
      officialName: 'UP',
      shortName: 'UP',
    });
    expect(
      published.teams
        .filter(({ schoolId }) => schoolId === 'source-label-up-42cb4e6f84')
        .map(({ id }) => id),
    ).toEqual([
      '2024-gpm-qualifier-1-row-0188-mixcoac',
      '2024-gpm-qualifier-2-row-0149-mixcoac',
      '2024-gpm-repechage-row-0065-mixcoac',
      '2024-mexico-finals-final-row-0234-mixcoac',
      '2025-mexico-finals-final-row-0204-7-up',
      '2025-mexico-finals-final-row-0495-upmat',
    ]);
  });

  it('consolidates UG-CIMAT without inferring a parent or merging DCNE and SENAI identities', async () => {
    const files = import.meta.glob<string>(['/data/**/*.json', '!/data/mock/**/*.json'], {
      query: '?raw',
      import: 'default',
    });
    const result = await createJsonScoreboardsRepository(files, 'archive').load();
    if (result.status !== 'ready') {
      throw new Error('Expected a valid published archive');
    }
    const published = result.data;
    const unit = selectSchoolScope(published, 'ug-cimat', 'school');
    if (unit.status !== 'found') {
      throw new Error('Expected UG-CIMAT scope');
    }
    expect(unit.record.school).toEqual({
      id: 'ug-cimat',
      officialName: 'Universidad de Guanajuato / Centro de Investigación en Matemáticas',
      shortName: 'UG-CIMAT',
    });
    expect(unit.record.teams).toHaveLength(116);
    expect(unit.record.teams.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        '2010-mexico-finals-global-row-0001-manowar',
        '2021-gpm-repechage-row-0052-owo',
        '2026-gpm-qualifier-1-row-0015-5747cd7d8393',
      ]),
    );
    expect(published.schools.some(({ id }) => id === 'source-school-3999b6144a49')).toBe(false);
    expect(published.teams.some(({ schoolId }) => schoolId === 'source-school-3999b6144a49')).toBe(
      false,
    );
    for (const [schoolId, count] of [
      ['source-label-universidad-de-guanajuato-dcne-f00dc1f3f7', 39],
      ['source-school-3e017bf58ae3', 7],
      ['ugto', 37],
      ['senai-cimatec', 5],
      ['source-label-senai-cimatec-eebe9d6039', 12],
      ['source-label-senai-cimatic-14250e4d55', 3],
    ] as const) {
      expect(published.teams.filter((team) => team.schoolId === schoolId)).toHaveLength(count);
    }
  });

  it('consolidates CUCEI history and assigns confirmed CUCEI Extreme without merging other UDG units', async () => {
    const files = import.meta.glob<string>(['/data/**/*.json', '!/data/mock/**/*.json'], {
      query: '?raw',
      import: 'default',
    });
    const result = await createJsonScoreboardsRepository(files, 'archive').load();
    if (result.status !== 'ready') {
      throw new Error('Expected a valid published archive');
    }
    const published = result.data;
    expect(published.schools.find(({ id }) => id === 'udg-cucei')).toEqual({
      id: 'udg-cucei',
      officialName: 'Centro Universitario de Ciencias Exactas e Ingenierías',
      shortName: 'UdG CUCEI',
      parentInstitutionId: 'udg',
    });
    for (const id of [
      'source-label-udg-cucei-86b0833dc5',
      'source-label-universidad-de-guadalajara-cucei-9cfd67a2df',
      'source-school-a48bd42dfe0f',
      'source-school-dec505bbb795',
    ]) {
      expect(published.schools.some((school) => school.id === id)).toBe(false);
      expect(published.teams.some((team) => team.schoolId === id)).toBe(false);
    }
    const unit = selectSchoolScope(published, 'udg-cucei', 'school');
    const institution = selectSchoolScope(published, 'udg', 'institution');
    const direct = selectSchoolScope(published, 'udg', 'school');
    if (unit.status !== 'found' || institution.status !== 'found' || direct.status !== 'found') {
      throw new Error('Expected CUCEI and UDG scopes');
    }
    expect(unit.record.teams).toHaveLength(447);
    expect(unit.record.teams.map(({ id }) => id)).toContain(
      '2025-mexico-finals-final-row-0568-cucei-extreme',
    );
    expect(institution.record.teams.map(({ id }) => id)).toEqual(
      expect.arrayContaining(unit.record.teams.map(({ id }) => id)),
    );
    expect(direct.record.teams.map(({ id }) => id)).toEqual([
      '2023-gpm-qualifier-2-row-0323-los-zermenitos',
    ]);
    for (const [schoolId, count] of [
      ['udg-cucosta', 61],
      ['udg-cusur', 2],
      ['udg-cutonala', 93],
      ['udg-cuvalles', 24],
    ] as const) {
      expect(published.teams.filter((team) => team.schoolId === schoolId)).toHaveLength(count);
    }
  });

  it('consolidates ITESM campuses under one university while keeping unrelated institutions separate', async () => {
    const files = import.meta.glob<string>(['/data/**/*.json', '!/data/mock/**/*.json'], {
      query: '?raw',
      import: 'default',
    });
    const result = await createJsonScoreboardsRepository(files, 'archive').load();
    if (result.status !== 'ready') {
      throw new Error('Expected a valid published archive');
    }
    const published = result.data;
    const institution = selectSchoolScope(published, 'itesm', 'institution');
    const direct = selectSchoolScope(published, 'itesm', 'school');
    if (institution.status !== 'found' || direct.status !== 'found') {
      throw new Error('Expected ITESM institutional and direct scopes');
    }
    expect(institution.record.school.shortName).toBe('Tec de Monterrey');
    expect(institution.record.schools).toHaveLength(20);
    expect(institution.record.teams).toHaveLength(1713);
    expect(direct.record.teams).toHaveLength(0);
    for (const [id, count] of [
      ['itesm-monterrey', 706],
      ['itesm-cem', 311],
      ['tec-puebla', 166],
      ['tec-guadalajara', 120],
      ['tec-queretaro', 120],
      ['tec-ciudad-de-mexico', 104],
      ['tec-monterrey-toluca', 70],
      ['itesm-cuernavaca', 34],
      ['tec-santa-fe', 33],
      ['itesm-chihuahua', 10],
      ['tec-aguascalientes', 9],
      ['itesm-morelia', 8],
      ['itesm-saltillo', 5],
      ['itesm-tampico', 4],
      ['itesm-zacatecas', 4],
      ['itesm-laguna', 4],
      ['itesm-leon', 2],
      ['itesm-central-veracruz', 2],
      ['itesm-san-luis', 1],
    ] as const) {
      const unit = selectSchoolScope(published, id, 'school');
      if (unit.status !== 'found') {
        throw new Error(`Expected ITESM campus ${id}`);
      }
      expect(unit.record.school.parentInstitutionId).toBe('itesm');
      expect(unit.record.school.officialName).toMatch(/^Tecnológico de Monterrey, Campus /);
      expect(unit.record.teams).toHaveLength(count);
      expect(institution.record.teams.map((team) => team.id)).toEqual(
        expect.arrayContaining(unit.record.teams.map((team) => team.id)),
      );
    }
    expect(published.schools.some(({ id }) => id === 'tec-mx')).toBe(false);
    expect(published.teams.some(({ schoolId }) => schoolId === 'tec-mx')).toBe(false);
    expect(
      published.teams.find(({ id }) => id === '2019-mexico-finals-final-row-0069-leftasanexercise')
        ?.schoolId,
    ).toBe('tec-queretaro');
    const includedIds = new Set(institution.record.teams.map(({ id }) => id));
    for (const schoolId of [
      'iteso',
      'udem-monterrey',
      'tecmilenio-las-torres',
      'tec-costa-rica',
      'tec-costa-rica-alajuela',
      'tecnm-parral',
      'source-label-tec-4e03be678c',
    ]) {
      const unrelated = published.teams.filter((team) => team.schoolId === schoolId);
      expect(unrelated.length).toBeGreaterThan(0);
      expect(unrelated.every(({ id }) => !includedIds.has(id))).toBe(true);
    }
  });

  it('consolidates UNAM units without inferring faculties for university-only registrations', async () => {
    const files = import.meta.glob<string>(['/data/**/*.json', '!/data/mock/**/*.json'], {
      query: '?raw',
      import: 'default',
    });
    const result = await createJsonScoreboardsRepository(files, 'archive').load();
    if (result.status !== 'ready') {
      throw new Error('Expected a valid published archive');
    }
    const published = result.data;
    const institution = selectSchoolScope(published, 'unam', 'institution');
    const direct = selectSchoolScope(published, 'unam', 'school');
    if (institution.status !== 'found' || direct.status !== 'found') {
      throw new Error('Expected UNAM institutional and direct scopes');
    }
    expect(institution.record.school.shortName).toBe('UNAM');
    expect(institution.record.teams).toHaveLength(813);
    expect(direct.record.teams).toHaveLength(15);
    expect(direct.record.teams.map(({ id }) => id)).toContain(
      '2010-mexico-finals-global-row-0121-bubulubu-fi-unam',
    );
    for (const [id, count] of [
      ['unam-fciencias', 248],
      ['unam-fi', 245],
      ['unam-fes-acatlan', 150],
      ['unam-enes-morelia', 127],
      ['unam-fes-cuautitlan', 10],
      ['unam-iimas', 9],
      ['unam-economia', 5],
      ['unam-cfata', 1],
      ['unam-cnyn', 3],
    ] as const) {
      const unit = selectSchoolScope(published, id, 'school');
      if (unit.status !== 'found') {
        throw new Error(`Expected UNAM unit ${id}`);
      }
      expect(unit.record.school.parentInstitutionId).toBe('unam');
      expect(unit.record.teams).toHaveLength(count);
      expect(institution.record.teams.map((team) => team.id)).toEqual(
        expect.arrayContaining(unit.record.teams.map((team) => team.id)),
      );
    }
    for (const id of ['unam-ingenieria', 'fes-acatlan', 'enes-morelia']) {
      expect(published.schools.some((school) => school.id === id)).toBe(false);
      expect(published.teams.some((team) => team.schoolId === id)).toBe(false);
    }
  });

  it('consolidates IPN units and keeps explicitly UNAM nanoscience registrations separate', async () => {
    const files = import.meta.glob<string>(['/data/**/*.json', '!/data/mock/**/*.json'], {
      query: '?raw',
      import: 'default',
    });
    const result = await createJsonScoreboardsRepository(files, 'archive').load();
    if (result.status !== 'ready') {
      throw new Error('Expected a valid published archive');
    }
    const published = result.data;
    const groups = [
      ['ipn-esfm', 'ipn', 134],
      ['ipn-upiiz', 'ipn', 66],
      ['ipn-esime-culhuacan', 'ipn', 35],
      ['ipn-esime-azcapotzalco', 'ipn', 3],
      ['ipn-upiicsa', 'ipn', 5],
      ['unam-cnyn', 'unam', 3],
      ['ipn-cnymyn', 'ipn', 47],
    ] as const;
    for (const [schoolId, parentId, count] of groups) {
      expect(published.schools.find(({ id }) => id === schoolId)?.parentInstitutionId).toBe(
        parentId,
      );
      const unit = selectSchoolScope(published, schoolId, 'school');
      const parent = selectSchoolScope(published, parentId, 'institution');
      if (unit.status !== 'found' || parent.status !== 'found') {
        throw new Error(`Expected unit and parent histories for ${schoolId}`);
      }
      expect(unit.record.teams).toHaveLength(count);
      expect(parent.record.teams.map(({ id }) => id)).toEqual(
        expect.arrayContaining(unit.record.teams.map(({ id }) => id)),
      );
    }
    expect(
      published.teams.find(({ id }) => id === '2022-gpm-qualifier-2-row-0096-siglo-xiii-upiiz')
        ?.schoolId,
    ).toBe('ipn-upiiz');
    for (const id of [
      '2023-gpm-iteso-853843-esimecu-anthrax',
      '2023-gpm-iteso-854139-esimecu-nullbyte',
      '2023-gpm-iteso-853848-esimecu-zeniith',
    ]) {
      expect(published.teams.find((team) => team.id === id)?.schoolId).toBe('ipn-esime-culhuacan');
    }
    const unamTeams = published.teams.filter(({ schoolId }) => schoolId === 'unam-cnyn');
    expect(unamTeams.map(({ id }) => id).toSorted()).toEqual([
      '2020-gpm-iteso-465287-hijos-de-turing',
      '2021-gpm-iteso-555386-sereno-el-fullereno-cnymyn',
      '2021-gpm-iteso-572238-angstroms-cnymyn',
    ]);
    const ipn = selectSchoolScope(published, 'ipn', 'institution');
    if (ipn.status !== 'found') {
      throw new Error('Expected IPN history');
    }
    const ipnIds = new Set(ipn.record.teams.map(({ id }) => id));
    expect(unamTeams.every(({ id }) => !ipnIds.has(id))).toBe(true);
    expect(published.teams.filter(({ schoolId }) => schoolId === 'ipn')).toHaveLength(0);
    expect(published.schools).toHaveLength(1067);
  });

  it('consolidates ESCOM registrations under its IPN unit without merging unrelated schools', async () => {
    const files = import.meta.glob<string>(['/data/**/*.json', '!/data/mock/**/*.json'], {
      query: '?raw',
      import: 'default',
    });
    const result = await createJsonScoreboardsRepository(files, 'archive').load();
    if (result.status !== 'ready') {
      throw new Error('Expected a valid published archive');
    }
    const published = result.data;
    expect(published.schools.find(({ id }) => id === 'ipn-escom')).toEqual({
      id: 'ipn-escom',
      officialName: 'Escuela Superior de Cómputo',
      shortName: 'ESCOM IPN',
      parentInstitutionId: 'ipn',
    });
    for (const id of [
      'source-label-escuela-superior-de-computo-instituto-politecnico-nacional-3ab1b04bc8',
      'source-school-23203f7743a5',
      'source-school-37806e2c8f27',
      'source-school-4eb7211dfff1',
      'source-school-e0819f018bde',
    ]) {
      expect(published.schools.some((school) => school.id === id)).toBe(false);
      expect(published.teams.some((team) => team.schoolId === id)).toBe(false);
    }
    const escom = selectSchoolHistory(published, 'ipn-escom', 'school');
    const ipn = selectSchoolHistory(published, 'ipn', 'institution');
    const directIpn = selectSchoolHistory(published, 'ipn', 'school');
    if (escom.status !== 'found' || ipn.status !== 'found' || directIpn.status !== 'found') {
      throw new Error('Expected ESCOM and IPN histories');
    }
    expect(escom.record.teams).toHaveLength(578);
    expect(ipn.record.teams.map(({ id }) => id)).toEqual(
      expect.arrayContaining(escom.record.teams.map(({ id }) => id)),
    );
    expect(directIpn.record.teams.some(({ schoolId }) => schoolId === 'ipn-escom')).toBe(false);
    expect(escom.record.contests.map(({ row }) => row.teamId)).toContain(
      '2012-mexico-finals-global-row-0001-escoders',
    );
    expect(escom.record.accumulated.map(({ row }) => row.teamId)).toContain(
      '2026-gpm-accumulated-1128527',
    );
    expect(
      published.teams.filter(({ schoolId }) => schoolId === 'source-label-descomplica-4b30f1b9b2'),
    ).toHaveLength(8);
  });

  it('keeps canonical BUAP registrations and rolls FCC history up without merging the faculty', async () => {
    const files = import.meta.glob<string>(['/data/**/*.json', '!/data/mock/**/*.json'], {
      query: '?raw',
      import: 'default',
    });
    const result = await createJsonScoreboardsRepository(files, 'archive').load();
    if (result.status !== 'ready') {
      throw new Error('Expected a valid published archive');
    }
    const published = result.data;
    expect(published.schools.filter(({ id }) => id.startsWith('buap'))).toEqual([
      {
        id: 'buap',
        officialName: 'Benemérita Universidad Autónoma de Puebla',
        shortName: 'BUAP',
      },
      {
        id: 'buap-fcc',
        officialName: 'Facultad de Ciencias de la Computación',
        shortName: 'FCC BUAP',
        parentInstitutionId: 'buap',
      },
    ]);
    for (const id of [
      'buap-mx',
      'source-school-1389d6b7512a',
      'source-school-5d06059e7144',
      'source-school-bfcfeb8363f7',
    ]) {
      expect(published.schools.some((school) => school.id === id)).toBe(false);
      expect(published.teams.some((team) => team.schoolId === id)).toBe(false);
    }
    for (const [schoolId, scope, count] of [
      ['buap', 'school', 142],
      ['buap', 'institution', 144],
      ['buap-fcc', 'school', 2],
    ] as const) {
      const history = selectSchoolHistory(published, schoolId, scope);
      if (history.status !== 'found') {
        throw new Error(`Expected history for ${schoolId}`);
      }
      expect(history.record.teams).toHaveLength(count);
      if (schoolId === 'buap-fcc' || scope === 'institution') {
        expect(history.record.accumulated.map(({ row }) => row.teamId)).toEqual(
          expect.arrayContaining([
            '2016-gpm-iteso-row-0112-voidcode',
            '2020-gpm-iteso-464522-faav-team',
          ]),
        );
      }
    }
  });

  it('loads mixed-detail historical records without losing explicit unknown values', async () => {
    const files = archiveFiles();
    files['data/mock/seasons/2024/gpm/qualifier-1.json'] = jsonFile(partialContest);
    files['data/mock/seasons/2024/gpm/standing.json'] = jsonFile(partialStanding);
    const result = await createJsonScoreboardsRepository(files, 'mock').load();
    expect(result).toMatchObject({
      status: 'ready',
      data: {
        contests: [partialContest],
        seasonStandings: [partialStanding],
      },
    });
  });

  it('rejects published totals that contradict detailed results at the repository boundary', async () => {
    const files = archiveFiles();
    files['data/mock/seasons/2024/gpm/qualifier-1.json'] = jsonFile({
      ...contest,
      standings: contest.standings.map((row, index) =>
        index === 0 ? { ...row, publishedTotals: { solved: 1, penalty: 999 } } : row,
      ),
    });
    const result = await createJsonScoreboardsRepository(files, 'mock').load();
    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') {
      throw new Error('Expected contradictory totals to fail validation');
    }
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ location: 'standings[0].publishedTotals.penalty' }),
      ]),
    );
    expect(result).not.toHaveProperty('data');
  });
  it.each(['mock', 'archive'] as const)(
    'selects %s through the development environment',
    async (source) => {
      vi.stubEnv('VITE_DATA_SOURCE', source);
      const repositories = await loadApplicationRepositories();
      expect(repositories.source).toBe(source);
      const expected = await loadApplicationData(
        createApplicationRepositories(
          source === 'mock'
            ? (await import('./mockDataFiles')).mockDataFiles
            : import.meta.glob<string>(['/data/**/*.json', '!/data/mock/**/*.json'], {
                query: '?raw',
                import: 'default',
              }),
          source,
        ),
      );
      expect(await loadApplicationData(repositories)).toEqual(expected);
    },
  );

  it.each(['', 'invalid', 'data/mock', 'MOCK'])(
    'rejects invalid development setting %j explicitly',
    async (value) => {
      vi.stubEnv('VITE_DATA_SOURCE', value);
      await expect(loadApplicationRepositories()).rejects.toThrow(
        'Invalid VITE_DATA_SOURCE: expected "mock" or "archive".',
      );
    },
  );

  it('validates development files and composes contest references into media without feature coupling', async () => {
    const repositories = await loadApplicationRepositories();
    expect(repositories.source).toBe('mock');
    const result = await loadApplicationData(repositories);
    expect(result.scoreboards.status).toBe('ready');
    expect(result.media.status).toBe('ready');
    if (result.scoreboards.status !== 'ready' || result.media.status !== 'ready') {
      throw new Error('Expected valid development records');
    }
    expect(result.scoreboards.data.contests.length).toBeGreaterThan(0);
    expect(result.media.data.events.length).toBeGreaterThan(0);
    for (const records of [result.scoreboards.data.schools, result.scoreboards.data.teams]) {
      expect(records.map(({ id }) => id)).toEqual(records.map(({ id }) => id).toSorted());
    }
  });

  it.each(['archive', 'mock'] as const)('never loads the other dataset for %s', async (source) => {
    const other = source === 'archive' ? 'mock' : 'archive';
    const loadOther = vi.fn(() => Promise.reject(new Error('must not load')));
    const files = {
      ...archiveFiles(source),
      ...Object.fromEntries(Object.keys(archiveFiles(other)).map((file) => [file, loadOther])),
    };
    const result = await loadApplicationData(createApplicationRepositories(files, source));
    expect(result.scoreboards.status).toBe('ready');
    expect(result.media.status).toBe('ready');
    expect(loadOther).not.toHaveBeenCalled();
  });

  it('returns empty archives, not invented fallback records or errors', async () => {
    const result = await loadApplicationData(
      createApplicationRepositories(archiveFiles(), 'archive'),
    );
    expect(result.scoreboards).toEqual({
      status: 'empty',
      data: { source: 'archive', schools: [], teams: [], contests: [], seasonStandings: [] },
    });
    expect(result.media).toEqual({ status: 'empty', data: { source: 'archive', events: [] } });
  });

  it('distinguishes empty collections and missing records in a valid archive', async () => {
    const result = await createJsonScoreboardsRepository(archiveFiles(), 'mock').load();
    if (result.status !== 'ready') {
      throw new Error('Expected valid records');
    }
    expect(selectContest(result.data, 'missing')).toEqual({ status: 'not-found' });
    expect(selectContest(result.data, contest.id)).toEqual({ status: 'found', record: contest });
    expect(selectSeasonStanding(result.data, 2024, 'gpm').status).toBe('found');
    expect(selectSeasonStanding(result.data, 2023, 'gpm')).toEqual({ status: 'not-found' });
    expect(
      await createJsonScoreboardsRepository(
        { 'data/schools.json': jsonFile([]) },
        'archive',
      ).load(),
    ).toMatchObject({ status: 'empty' });
  });

  it('preserves schema and JSON diagnostics and does not expose a partial archive', async () => {
    const files = archiveFiles();
    files['data/mock/schools.json'] = jsonFile([{ id: 42 }]);
    files['data/mock/seasons/2024/gpm/qualifier-1.json'] = () => Promise.resolve('{');
    const result = await loadApplicationData(createApplicationRepositories(files, 'mock'));
    expect(result.scoreboards.status).toBe('invalid');
    if (result.scoreboards.status !== 'invalid') {
      throw new Error('Expected invalid records');
    }
    expect(result.scoreboards.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ file: 'data/mock/schools.json', location: '[0].id' }),
        expect.objectContaining({
          file: 'data/mock/seasons/2024/gpm/qualifier-1.json',
          location: '',
        }),
      ]),
    );
    expect(
      result.scoreboards.issues.some(({ message }) => message.includes('not valid JSON')),
    ).toBe(true);
    expect(result.scoreboards).not.toHaveProperty('data');
    expect(result.media).toEqual({ status: 'blocked' });
  });

  it('distinguishes load errors and retains other record diagnostics', async () => {
    const files = archiveFiles();
    files['data/mock/schools.json'] = () => Promise.reject(new Error('disk unavailable'));
    files['data/mock/seasons/2024/gpm/qualifier-1.json'] = jsonFile({});
    const result = await createJsonScoreboardsRepository(files, 'mock').load();
    expect(result.status).toBe('error');
    if (result.status !== 'error') {
      throw new Error('Expected load error');
    }
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: 'data/mock/schools.json',
        }),
        expect.objectContaining({ location: 'durationMinutes' }),
      ]),
    );
    expect(result.issues.some(({ message }) => message.includes('disk unavailable'))).toBe(true);
  });

  it('rejects archive references even if the missing record exists in mock data', async () => {
    const files = { ...archiveFiles(), ...archiveFiles('archive') };
    files['data/schools.json'] = jsonFile([]);
    const result = await createJsonScoreboardsRepository(files, 'archive').load();
    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') {
      throw new Error('Expected invalid references');
    }
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ location: '[0].schoolId' })]),
    );
  });

  it('checks file locations, duplicate identities, school hierarchy and season-scoped teams', async () => {
    const files = archiveFiles();
    files['data/mock/schools.json'] = jsonFile([
      ...archive.schools,
      { id: 'uni', officialName: 'Duplicate', shortName: 'D' },
      { id: 'cycle', officialName: 'Cycle', shortName: 'C', parentInstitutionId: 'cycle' },
    ]);
    files['data/mock/seasons/2025/teams.json'] = jsonFile(archive.teams);
    files['data/mock/seasons/2025/other/final.json'] = jsonFile(contest);
    files['data/mock/seasons/2025/other/standing.json'] =
      files['data/mock/seasons/2024/gpm/standing.json'];
    files['data/mock/seasons/2025/gpm/qualifier-1.json'] = jsonFile({
      ...contest,
      id: '2025-gpm-q1',
      seasonYear: 2025,
    });
    files['data/mock/unknown.json'] = jsonFile({});
    const result = await createJsonScoreboardsRepository(files, 'mock').load();
    if (result.status !== 'invalid') {
      throw new Error('Expected invalid references');
    }
    const messages = result.issues.map(({ message }) => message).join('\n');
    expect(messages).toContain('duplicate school');
    expect(messages).toContain('cannot be its own parent');
    expect(messages).toContain('duplicate team');
    expect(messages).toContain('duplicate contest');
    expect(messages).toContain('duplicate season standing');
    expect(messages).toContain('does not match the season');
    expect(messages).toContain('does not match the series');
    expect(messages).toContain('registered for season 2024, not 2025');
    expect(messages).toContain('unrecognized scoreboard data path');
  });
});

describe('media repository', () => {
  it('keeps valid standings available when media is invalid', async () => {
    const files = archiveFiles();
    files['data/mock/media/events/2024-gpm-event.json'] = jsonFile({});
    const result = await loadApplicationData(createApplicationRepositories(files, 'mock'));
    expect(result.scoreboards.status).toBe('ready');
    expect(result.media.status).toBe('invalid');
  });

  it('validates event/post files and returns explicit missing event results', async () => {
    const result = await createJsonMediaRepository(archiveFiles(), 'mock').load(
      new Set([contest.id]),
    );
    if (result.status !== 'ready') {
      throw new Error('Expected valid event');
    }
    expect(selectEvent(result.data, eventFile.event.id)).toEqual({
      status: 'found',
      record: eventFile,
    });
    expect(selectEvent(result.data, 'missing')).toEqual({ status: 'not-found' });
  });

  it('reports unknown contests/posts, orphaned posts, duplicate events/posts and repeated references', async () => {
    const invalidEvent = {
      ...eventFile,
      event: { ...eventFile.event, postIds: ['post-a', 'missing', 'post-a'] },
    };
    const result = await createJsonMediaRepository(
      {
        'data/mock/media/events/a.json': jsonFile(invalidEvent),
        'data/mock/media/events/b.json': jsonFile(eventFile),
      },
      'mock',
    ).load(new Set());
    if (result.status !== 'invalid') {
      throw new Error('Expected invalid event references');
    }
    const messages = result.issues.map(({ message }) => message).join('\n');
    expect(messages).toContain('unknown contest');
    expect(messages).toContain('unknown post');
    expect(messages).toContain('not listed');
    expect(messages).toContain('duplicate event');
    expect(messages).toContain('duplicate post id');
    expect(messages).toContain('duplicate post reference');
  });

  it('distinguishes schema errors, file-layout errors and load errors', async () => {
    const files = {
      'data/mock/media/events/a.json': jsonFile({}),
      'data/mock/media/unknown.json': jsonFile({}),
    };
    const result = await createJsonMediaRepository(files, 'mock').load(new Set());
    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') {
      throw new Error('Expected invalid media records');
    }
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ location: 'event' }),
        expect.objectContaining({ message: 'unrecognized media data path' }),
      ]),
    );
    expect(
      await createJsonMediaRepository(
        {
          'data/mock/media/events/a.json': () => Promise.reject(new Error('offline')),
        },
        'mock',
      ).load(new Set()),
    ).toMatchObject({ status: 'error' });
  });
});

describe('application feed selection', () => {
  const media = { source: 'mock' as const, events: [eventFile] };

  it('uses the Mexico City calendar day rather than the UTC date', () => {
    const instant = new Date('2024-03-02T02:00:00Z');
    expect(mexicoCityDate(instant)).toBe('2024-03-01');
    expect(selectLatestFeed(archive, media, instant).status).toBe('found');
  });

  it('never substitutes an older contest feed when the latest held contest has no eligible media', () => {
    expect(
      selectLatestFeed(
        {
          ...archive,
          contests: [...archive.contests, { ...contest, id: 'newer', date: '2024-03-02' }],
        },
        media,
        new Date('2024-03-03T12:00:00Z'),
      ),
    ).toEqual({ status: 'not-found' });
    expect(selectLatestFeed({ ...archive, contests: [] }, media, new Date())).toEqual({
      status: 'not-found',
    });
  });
});
