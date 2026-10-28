import type { EventFile } from '@/features/media';
import type { Contest, SeasonStanding } from '@/features/scoreboards/model/schemas';
import type { ScoreboardsArchive } from '@/features/scoreboards/repositories/scoreboardsRepository';
import type { DatasetSource, JsonFiles } from '@/lib/data/repository';

export const contest: Contest = {
  id: '2024-gpm-q1',
  seasonYear: 2024,
  seriesId: 'gpm',
  stage: 'qualifier-1',
  name: 'Contest',
  date: '2024-03-01',
  durationMinutes: 300,
  penaltyMinutesPerFailedAttempt: 15,
  problems: [{ label: 'A' }, { label: 'B' }, { label: 'C' }],
  standings: [
    {
      place: 1,
      teamId: '2024-a',
      results: [
        { status: 'solved', attempts: 2, solvedAtMinute: 10 },
        { status: 'attempted', attempts: 9 },
        { status: 'unattempted' },
      ],
    },
    {
      place: 2,
      teamId: '2024-b',
      results: [
        { status: 'solved', attempts: 1, solvedAtMinute: 10 },
        { status: 'solved', attempts: 3, solvedAtMinute: 20 },
        { status: 'unattempted' },
      ],
    },
    {
      place: 2,
      teamId: '2024-c',
      results: [
        { status: 'solved', attempts: 1, solvedAtMinute: 40 },
        { status: 'solved', attempts: 1, solvedAtMinute: 5 },
        { status: 'unattempted' },
      ],
    },
    {
      place: 4,
      teamId: '2024-d',
      results: [
        { status: 'attempted', attempts: 4 },
        { status: 'unattempted' },
        { status: 'unattempted' },
      ],
    },
  ],
  source: 'https://example.com/contest',
};

export const standing: SeasonStanding = {
  seasonYear: 2024,
  seriesId: 'gpm',
  rows: [
    { place: 1, teamId: '2024-a', score: 12.75, qualified: true },
    { place: 2, teamId: '2024-b', score: 9.25, qualified: true },
    { place: 3, teamId: '2024-c', score: 7, qualified: false },
    { place: 4, teamId: '2024-d', score: 5, qualified: false },
  ],
  source: 'https://example.com/standing',
};

export const partialContest: Contest = {
  ...contest,
  stage: 'fecha-0',
  name: 'Concurso histórico parcial',
  date: null,
  durationMinutes: null,
  penaltyMinutesPerFailedAttempt: null,
  standings: contest.standings.map((row, index) =>
    index === 0
      ? {
          place: row.place,
          teamId: row.teamId,
          results: null,
          publishedTotals: { solved: 1, penalty: null },
        }
      : row,
  ),
};

export const partialStanding: SeasonStanding = {
  ...standing,
  rows: standing.rows.map((row, index) => ({
    ...row,
    qualified: index === 1 ? null : row.qualified,
  })),
};

export const archive: ScoreboardsArchive = {
  source: 'mock',
  schools: [
    { id: 'uni', officialName: 'University', shortName: 'UNI' },
    { id: 'unit', officialName: 'Unit', shortName: 'UNIT', parentInstitutionId: 'uni' },
    { id: 'campus', officialName: 'Campus', shortName: 'C', parentInstitutionId: 'unit' },
    { id: 'solo', officialName: 'Standalone', shortName: 'S' },
    { id: 'unused', officialName: 'No registrations', shortName: 'N' },
  ],
  teams: [
    { id: '2024-a', name: 'Alpha', schoolId: 'unit', seasonYear: 2024 },
    { id: '2024-b', name: 'Beta', schoolId: 'campus', seasonYear: 2024 },
    { id: '2024-c', name: 'Gamma', schoolId: 'solo', seasonYear: 2024 },
    { id: '2024-d', name: 'Delta', schoolId: 'unit', seasonYear: 2024 },
  ],
  contests: [contest],
  seasonStandings: [standing],
};

export const eventFile: EventFile = {
  event: {
    id: '2024-gpm-event',
    name: 'Event',
    date: '2024-03-01',
    hashtag: '#GPM2024',
    contestId: contest.id,
    postIds: ['post-a', 'post-b'],
  },
  posts: ['post-b', 'post-a'].map((id) => ({
    id,
    source: 'x',
    author: { username: 'club' },
    postedAt: '2024-03-01T18:00:00Z',
    body: id,
    media: [],
    permalink: `https://example.com/${id}`,
    tags: [],
  })),
};

export const jsonFile =
  (value: unknown): (() => Promise<string>) =>
  () =>
    Promise.resolve(JSON.stringify(value));

export const archiveFiles = (source: DatasetSource = 'mock'): JsonFiles => {
  const root = source === 'archive' ? 'data' : 'data/mock';
  return {
    [`${root}/schools.json`]: jsonFile(archive.schools),
    [`${root}/seasons/2024/teams.json`]: jsonFile(archive.teams),
    [`${root}/seasons/2024/gpm/qualifier-1.json`]: jsonFile(contest),
    [`${root}/seasons/2024/gpm/standing.json`]: jsonFile(standing),
    [`${root}/media/events/2024-gpm-event.json`]: jsonFile(eventFile),
  };
};
