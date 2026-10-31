import { type MediaArchive, selectContestFeed } from '@/features/media';
import {
  type Contest,
  type ScoreboardsArchive,
  selectContest,
  selectLatestHeldContest,
} from '@/features/scoreboards';
import { mexicoCityDate } from '@/lib/dates';

import { loadApplicationRepositories } from './applicationData';
import { loadScoreboards } from './loadScoreboards';

import type { RepositoryResult } from '@/lib/data/repository';

export interface MediaContestOption {
  contest: Contest;
  feed: Extract<ReturnType<typeof selectContestFeed>, { status: 'found' }>;
}

export interface MediaPageData {
  scoreboards: RepositoryResult<ScoreboardsArchive>;
  media: RepositoryResult<MediaArchive> | { status: 'blocked' };
  latestContest: Contest | undefined;
  selectedContest: Contest | undefined;
  contestsWithMedia: MediaContestOption[];
  selectionError: 'repeated' | 'not-found' | undefined;
  feed: ReturnType<typeof selectContestFeed>;
}

export const selectMediaPageData = (
  scoreboards: RepositoryResult<ScoreboardsArchive>,
  media: RepositoryResult<MediaArchive> | { status: 'blocked' },
  instant: Date,
  requestedContestId?: string,
  repeatedSelection = false,
): MediaPageData => {
  if (scoreboards.status === 'invalid' || scoreboards.status === 'error') {
    return {
      scoreboards,
      media: { status: 'blocked' },
      latestContest: undefined,
      selectedContest: undefined,
      contestsWithMedia: [],
      selectionError: undefined,
      feed: { status: 'not-found' },
    };
  }

  const today = mexicoCityDate(instant);
  const latest = selectLatestHeldContest(scoreboards.data, today);
  const latestContest = latest.status === 'found' ? latest.record : undefined;
  const contestsWithMedia =
    media.status === 'ready' || media.status === 'empty'
      ? scoreboards.data.contests
          .filter((contest) => contest.date !== null && contest.date <= today)
          .toSorted(
            (a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.id.localeCompare(b.id),
          )
          .flatMap((contest) => {
            const feed = selectContestFeed(media.data, contest.id, today);
            return feed.status === 'found' && feed.record.posts.length > 0
              ? [{ contest, feed }]
              : [];
          })
      : [];
  const requestedContest =
    requestedContestId === undefined
      ? undefined
      : selectContest(scoreboards.data, requestedContestId);
  const selectedContest = repeatedSelection
    ? undefined
    : requestedContestId === undefined
      ? latestContest
      : requestedContest?.status === 'found' &&
          requestedContest.record.date !== null &&
          requestedContest.record.date <= today
        ? requestedContest.record
        : undefined;
  const selectionError = repeatedSelection
    ? 'repeated'
    : requestedContestId !== undefined && selectedContest === undefined
      ? 'not-found'
      : undefined;
  const feed =
    selectedContest !== undefined &&
    (media.status === 'ready' || media.status === 'empty') &&
    selectionError === undefined
      ? selectContestFeed(media.data, selectedContest.id, today)
      : { status: 'not-found' as const };

  return {
    scoreboards,
    media,
    latestContest,
    selectedContest,
    contestsWithMedia,
    selectionError,
    feed,
  };
};

export const loadMediaPage = async ({ request }: { request: Request }): Promise<MediaPageData> => {
  const selections = new URL(request.url).searchParams.getAll('contest');
  const scoreboards = await loadScoreboards();
  if (scoreboards.status === 'invalid' || scoreboards.status === 'error') {
    return selectMediaPageData(
      scoreboards,
      { status: 'blocked' },
      new Date(),
      selections.length === 1 ? selections[0] : undefined,
      selections.length > 1,
    );
  }

  const repositories = await loadApplicationRepositories();
  const media = await repositories.media.load(
    new Set(scoreboards.data.contests.map(({ id }) => id)),
  );
  if (media.status === 'invalid' || media.status === 'error') {
    console.error('Could not load media archive.', media.issues);
  }

  return selectMediaPageData(
    scoreboards,
    media,
    new Date(),
    selections.length === 1 ? selections[0] : undefined,
    selections.length > 1,
  );
};
