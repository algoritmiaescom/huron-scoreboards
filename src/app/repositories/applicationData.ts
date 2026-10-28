import { z } from 'zod';

import {
  createJsonMediaRepository,
  type MediaArchive,
  type MediaRepository,
  selectContestFeed,
} from '@/features/media';
import {
  createJsonScoreboardsRepository,
  type ScoreboardsArchive,
  type ScoreboardsRepository,
  selectLatestHeldContest,
} from '@/features/scoreboards';
import { mexicoCityDate } from '@/lib/dates';

import type { DatasetSource, JsonFiles } from '@/lib/data/repository';

export interface ApplicationRepositories {
  source: DatasetSource;
  scoreboards: ScoreboardsRepository;
  media: MediaRepository;
}

export const createApplicationRepositories = (
  files: JsonFiles,
  source: DatasetSource,
): ApplicationRepositories => ({
  source,
  scoreboards: createJsonScoreboardsRepository(files, source),
  media: createJsonMediaRepository(files, source),
});

export const loadApplicationRepositories = async (): Promise<ApplicationRepositories> => {
  if (import.meta.env.DEV) {
    const source = z
      .enum(['mock', 'archive'])
      .safeParse(import.meta.env.VITE_DATA_SOURCE ?? 'mock');
    if (!source.success) {
      throw new Error('Invalid VITE_DATA_SOURCE: expected "mock" or "archive".');
    }
    if (source.data === 'mock') {
      const { mockDataFiles } = await import('./mockDataFiles');
      return createApplicationRepositories(mockDataFiles, 'mock');
    }
  }
  return createApplicationRepositories(
    import.meta.glob<string>(['/data/**/*.json', '!/data/mock/**/*.json'], {
      query: '?raw',
      import: 'default',
    }),
    'archive',
  );
};

export const loadApplicationData = async (repositories: ApplicationRepositories) => {
  const scoreboards = await repositories.scoreboards.load();
  if (scoreboards.status === 'invalid' || scoreboards.status === 'error') {
    return { scoreboards, media: { status: 'blocked' as const } };
  }
  const media = await repositories.media.load(
    new Set(scoreboards.data.contests.map(({ id }) => id)),
  );
  return { scoreboards, media };
};

export const selectLatestFeed = (
  scoreboards: ScoreboardsArchive,
  media: MediaArchive,
  instant: Date,
) => {
  const today = mexicoCityDate(instant);
  const contest = selectLatestHeldContest(scoreboards, today);
  return contest.status === 'found'
    ? selectContestFeed(media, contest.record.id, today)
    : { status: 'not-found' as const };
};
