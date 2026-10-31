import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createJsonMediaRepository, selectEvent } from '@/features/media';
import {
  createJsonScoreboardsRepository,
  selectContest,
  selectSeasonStanding,
} from '@/features/scoreboards';
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
