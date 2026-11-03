import { type MediaArchive, selectEventFeed } from '@/features/media';
import { type Contest, type ScoreboardsArchive, selectContest } from '@/features/scoreboards';

import { loadApplicationRepositories } from './applicationData';
import { loadScoreboards } from './loadScoreboards';

import type { RepositoryResult } from '@/lib/data/repository';

type EventFeed = Extract<ReturnType<typeof selectEventFeed>, { status: 'found' }>;

export interface MediaPageData {
  scoreboards: RepositoryResult<ScoreboardsArchive>;
  media: RepositoryResult<MediaArchive> | { status: 'blocked' };
  selectedContest: Contest | undefined;
  eventsWithMedia: EventFeed[];
  defaultEventId: string | undefined;
  selectionError: 'repeated' | 'not-found' | undefined;
  feed: ReturnType<typeof selectEventFeed>;
}

export const selectMediaPageData = (
  scoreboards: RepositoryResult<ScoreboardsArchive>,
  media: RepositoryResult<MediaArchive> | { status: 'blocked' },
  instant: Date,
  requestedContestId?: string,
  repeatedSelection = false,
  requestedEventId?: string,
): MediaPageData => {
  if (scoreboards.status === 'invalid' || scoreboards.status === 'error') {
    return {
      scoreboards,
      media: { status: 'blocked' },
      selectedContest: undefined,
      eventsWithMedia: [],
      defaultEventId: undefined,
      selectionError: undefined,
      feed: { status: 'not-found' },
    };
  }
  const feeds =
    media.status === 'ready' || media.status === 'empty'
      ? media.data.events
          .toSorted(
            (a, b) =>
              b.event.date.localeCompare(a.event.date) || a.event.id.localeCompare(b.event.id),
          )
          .flatMap(({ event }) => {
            const feed = selectEventFeed(media.data, event.id, instant);
            return feed.status === 'found' ? [feed] : [];
          })
      : [];
  const eventsWithMedia = feeds.filter(({ record }) => record.posts.length > 0);
  const defaultFeed = eventsWithMedia.at(0) ?? feeds.at(0);
  const requestedContest =
    requestedContestId !== undefined
      ? selectContest(scoreboards.data, requestedContestId)
      : undefined;
  const selection = repeatedSelection
    ? undefined
    : requestedEventId !== undefined
      ? feeds.find(({ record }) => record.event.id === requestedEventId)
      : requestedContestId !== undefined
        ? feeds.find(({ record }) => record.event.contestId === requestedContestId)
        : defaultFeed;
  const selectionError = repeatedSelection
    ? 'repeated'
    : requestedEventId !== undefined && selection === undefined
      ? 'not-found'
      : requestedContestId !== undefined && requestedContest?.status !== 'found'
        ? 'not-found'
        : undefined;
  const feed =
    selectionError === undefined
      ? (selection ?? { status: 'not-found' as const })
      : { status: 'not-found' as const };
  const contestId = feed.status === 'found' ? feed.record.event.contestId : requestedContestId;
  const contest = contestId !== undefined ? selectContest(scoreboards.data, contestId) : undefined;

  return {
    scoreboards,
    media,
    selectedContest:
      selectionError === undefined && contest?.status === 'found' ? contest.record : undefined,
    eventsWithMedia,
    defaultEventId: defaultFeed?.record.event.id,
    selectionError,
    feed,
  };
};

export const loadMediaPage = async ({ request }: { request: Request }): Promise<MediaPageData> => {
  const params = new URL(request.url).searchParams;
  const contests = params.getAll('contest');
  const events = params.getAll('event');
  const repeatedSelection = contests.length + events.length > 1;
  const scoreboards = await loadScoreboards();
  if (scoreboards.status === 'invalid' || scoreboards.status === 'error') {
    return selectMediaPageData(
      scoreboards,
      { status: 'blocked' },
      new Date(),
      contests[0],
      repeatedSelection,
      events[0],
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
    contests[0],
    repeatedSelection,
    events[0],
  );
};
