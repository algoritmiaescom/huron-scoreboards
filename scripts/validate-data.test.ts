import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { formatIssue } from '@/lib/validation/issues';

import { validateDataDirectory } from './data-validation';

const createdRoots: string[] = [];

const createRoot = async (): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), 'huron-scoreboards-'));

  createdRoots.push(root);

  return root;
};

const writeJson = async (root: string, relativePath: string, value: unknown): Promise<void> => {
  const filePath = path.join(root, relativePath);

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const validData = async (root: string, prefix = 'data'): Promise<void> => {
  await writeJson(root, `${prefix}/schools.json`, [
    {
      id: 'ipn-escom',
      officialName: 'Escuela Superior de Cómputo',
      shortName: 'ESCOM',
    },
  ]);

  await writeJson(root, `${prefix}/seasons/2024/teams.json`, [
    {
      id: '2024-huron-tigers',
      name: 'Huron Tigers',
      schoolId: 'ipn-escom',
      seasonYear: 2024,
    },
  ]);

  await writeJson(root, `${prefix}/seasons/2024/gpm/qualifier-1.json`, {
    id: '2024-gpm-q1',
    seasonYear: 2024,
    seriesId: 'gpm',
    stage: 'qualifier-1',
    name: 'GPM 2024 qualifier 1',
    date: '2024-03-10',
    durationMinutes: 300,
    penaltyMinutesPerFailedAttempt: 20,
    problems: [{ label: 'A', title: 'Warmup' }],
    standings: [
      {
        place: 1,
        teamId: '2024-huron-tigers',
        results: [{ status: 'solved', attempts: 1, solvedAtMinute: 18 }],
      },
    ],
    source: 'https://example.com/gpm-2024-q1',
  });

  await writeJson(root, `${prefix}/seasons/2024/gpm/standing.json`, {
    seasonYear: 2024,
    seriesId: 'gpm',
    rows: [
      {
        place: 1,
        teamId: '2024-huron-tigers',
        score: 100,
        qualified: true,
      },
    ],
    source: 'https://example.com/gpm-2024-standing',
  });

  await writeJson(root, `${prefix}/media/events/2024-gpm.json`, {
    event: {
      id: '2024-gpm',
      name: 'GPM 2024',
      date: '2024-03-10',
      hashtag: '#GPM2024',
      location: 'Mexico City',
      contestId: '2024-gpm-q1',
      postIds: ['post-1'],
    },
    posts: [
      {
        id: 'post-1',
        source: 'x',
        author: {
          username: 'huron-club',
          displayName: 'Huron Algorithms Club',
          profileUrl: 'https://example.com/huron',
        },
        postedAt: '2024-03-10T15:00:00-06:00',
        body: 'Great start to GPM 2024!',
        media: [
          {
            type: 'image',
            url: 'https://example.com/image.jpg',
            alt: 'Students celebrating the first contest',
          },
        ],
        permalink: 'https://example.com/posts/1',
        tags: ['#GPM2024'],
      },
    ],
  });
};

const invalidData = async (root: string): Promise<void> => {
  await validData(root);

  await writeJson(root, 'data/media/events/2024-gpm.json', {
    event: {
      id: '2024-gpm',
      name: 'GPM 2024',
      date: '2024-03-10',
      hashtag: '#GPM2024',
      contestId: 'missing-contest',
      postIds: ['missing-post'],
    },
    posts: [
      {
        id: 'post-1',
        source: 'x',
        author: {
          username: 'huron-club',
          displayName: 'Huron Algorithms Club',
        },
        postedAt: '2024-03-10T15:00:00-06:00',
        body: 'Great start to GPM 2024!',
        media: [
          {
            type: 'image',
            url: 'https://example.com/image.jpg',
            alt: 'Students celebrating the first contest',
          },
        ],
        permalink: 'https://example.com/posts/1',
        tags: ['#GPM2024'],
      },
    ],
  });
};

afterEach(async () => {
  await Promise.all(createdRoots.map((root) => rm(root, { recursive: true, force: true })));
  createdRoots.length = 0;
});

describe('validateDataDirectory', () => {
  it('accepts coherent mocked data', async () => {
    const root = await createRoot();
    await validData(root);

    const report = await validateDataDirectory(root);

    expect(report.fileCount).toBe(5);
    expect(report.issues).toHaveLength(0);
  });

  it('validates a nested dataset directory without mixing it into the parent', async () => {
    const root = await createRoot();
    await validData(root, 'data/mock');

    const mock = await validateDataDirectory(root, path.join(root, 'data', 'mock'));

    expect(mock.fileCount).toBe(5);
    expect(mock.issues).toHaveLength(0);

    const parent = await validateDataDirectory(root, path.join(root, 'data'));

    expect(parent.fileCount).toBe(0);
    expect(parent.issues).toHaveLength(0);
  });

  it('reports schema and cross-reference problems in mocked data', async () => {
    const root = await createRoot();
    await invalidData(root);

    const report = await validateDataDirectory(root);
    const rendered = report.issues.map(formatIssue);

    expect(rendered).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'data/media/events/2024-gpm.json event.postIds[0]: unknown post `missing-post`',
        ),
        expect.stringContaining(
          'data/media/events/2024-gpm.json event.contestId: unknown contest `missing-contest`',
        ),
      ]),
    );
  });

  it('reports schema problems in mocked data', async () => {
    const root = await createRoot();
    await validData(root);

    await writeJson(root, 'data/media/events/2024-gpm.json', {
      event: {
        id: '2024-gpm',
        name: 'GPM 2024',
        date: '2024-03-10',
        hashtag: '#GPM2024',
        contestId: '2024-gpm-q1',
        postIds: ['post-1'],
      },
      posts: [
        {
          id: 'post-1',
          source: 'x',
          author: {
            username: 'huron-club',
          },
          postedAt: '2024-03-10T15:00:00-06:00',
          body: 'Great start to GPM 2024!',
          media: [
            {
              type: 'image',
              url: 'https://example.com/image.jpg',
            },
          ],
          permalink: 'https://example.com/posts/1',
          tags: ['#GPM2024'],
        },
      ],
    });

    const report = await validateDataDirectory(root);
    const rendered = report.issues.map(formatIssue);

    expect(rendered).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'data/media/events/2024-gpm.json posts[0].media[0].alt: Invalid input: expected string, received undefined',
        ),
      ]),
    );
  });
});
