import { describe, expect, it } from 'vitest';

import { archive, eventFile } from '@/test/fixtures/archive';

import { selectMediaPageData } from './loadMediaPage';

describe('media page selection', () => {
  const instant = new Date('2024-03-02T12:00:00Z');
  const scoreboards = { status: 'ready' as const, data: archive };
  const media = {
    status: 'ready' as const,
    data: { source: 'mock' as const, events: [eventFile] },
  };
  const upcoming = {
    ...eventFile,
    event: { ...eventFile.event, id: 'upcoming', contestId: undefined, date: '2024-04-01' },
  };

  it('defaults to the newest event with published posts, independent of contest availability', () => {
    const result = selectMediaPageData(
      { status: 'empty', data: { ...archive, contests: [] } },
      { ...media, data: { ...media.data, events: [eventFile, upcoming] } },
      instant,
    );
    expect(result.defaultEventId).toBe('upcoming');
    expect(result.selectedContest).toBeUndefined();
    expect(result.feed).toMatchObject({
      status: 'found',
      record: { event: { id: 'upcoming' }, posts: [{ id: 'post-a' }, { id: 'post-b' }] },
    });
    expect(result.eventsWithMedia.map(({ record }) => record.event.id)).toEqual([
      'upcoming',
      eventFile.event.id,
    ]);
  });

  it('does not let a newer event without published posts hide available media', () => {
    const result = selectMediaPageData(
      scoreboards,
      {
        ...media,
        data: {
          ...media.data,
          events: [
            eventFile,
            {
              ...upcoming,
              posts: upcoming.posts.map((post) => ({ ...post, postedAt: '2024-04-01T12:00:00Z' })),
            },
          ],
        },
      },
      instant,
    );
    expect(result.defaultEventId).toBe(eventFile.event.id);
    expect(result.eventsWithMedia).toHaveLength(1);
  });

  it('breaks equal event dates by ascending id and supports explicit event selections', () => {
    const result = selectMediaPageData(
      scoreboards,
      {
        ...media,
        data: {
          ...media.data,
          events: [upcoming, { ...upcoming, event: { ...upcoming.event, id: 'a' } }],
        },
      },
      instant,
      undefined,
      false,
      'upcoming',
    );
    expect(result.defaultEventId).toBe('a');
    expect(result.feed).toMatchObject({ status: 'found', record: { event: { id: 'upcoming' } } });
  });

  it('preserves legacy contest links and optional scoreboard context, including undated contests', () => {
    const result = selectMediaPageData(
      { ...scoreboards, data: { ...archive, contests: [{ ...archive.contests[0], date: null }] } },
      media,
      instant,
      archive.contests[0].id,
    );
    expect(result.selectedContest?.id).toBe(archive.contests[0].id);
    expect(result.feed.status).toBe('found');
  });

  it('keeps a valid contest without media empty rather than substituting another event', () => {
    const contest = { ...archive.contests[0], id: 'no-media' };
    const result = selectMediaPageData(
      { ...scoreboards, data: { ...archive, contests: [contest] } },
      { ...media, data: { ...media.data, events: [upcoming] } },
      instant,
      contest.id,
    );
    expect(result.selectedContest?.id).toBe(contest.id);
    expect(result.selectionError).toBeUndefined();
    expect(result.feed).toEqual({ status: 'not-found' });
  });

  it.each(['event', 'contest'])('rejects unknown %s selections without falling back', (kind) => {
    const result = selectMediaPageData(
      scoreboards,
      media,
      instant,
      kind === 'contest' ? 'missing' : undefined,
      false,
      kind === 'event' ? 'missing' : undefined,
    );
    expect(result.selectionError).toBe('not-found');
    expect(result.feed).toEqual({ status: 'not-found' });
  });

  it('rejects repeated or mixed selections', () => {
    const result = selectMediaPageData(scoreboards, media, instant, undefined, true);
    expect(result.selectionError).toBe('repeated');
    expect(result.feed).toEqual({ status: 'not-found' });
  });

  it('preserves empty event, missing archive, and repository error states', () => {
    const emptyEvent = { ...eventFile, event: { ...eventFile.event, postIds: [] }, posts: [] };
    expect(
      selectMediaPageData(
        scoreboards,
        { ...media, data: { ...media.data, events: [emptyEvent] } },
        instant,
      ).feed,
    ).toMatchObject({ status: 'found', record: { posts: [] } });
    expect(
      selectMediaPageData(
        scoreboards,
        { status: 'empty', data: { source: 'archive', events: [] } },
        instant,
      ).feed,
    ).toEqual({ status: 'not-found' });
    expect(selectMediaPageData({ status: 'invalid', issues: [] }, media, instant)).toMatchObject({
      media: { status: 'blocked' },
      feed: { status: 'not-found' },
    });
    expect(
      selectMediaPageData(scoreboards, { status: 'error', issues: [] }, instant),
    ).toMatchObject({ media: { status: 'error' }, feed: { status: 'not-found' } });
  });
});
