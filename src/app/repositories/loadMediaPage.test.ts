import { describe, expect, it } from 'vitest';

import { archive, eventFile } from '@/test/fixtures/archive';

import { selectMediaPageData } from './loadMediaPage';

describe('media page selection', () => {
  const instant = new Date('2024-03-02T12:00:00Z');
  const media = { source: 'mock' as const, events: [eventFile] };

  it('selects the newest linked event and its explicitly ordered posts for the latest held contest', () => {
    const result = selectMediaPageData(
      { status: 'ready', data: archive },
      { status: 'ready', data: media },
      instant,
    );
    expect(result.latestContest?.id).toBe('2024-gpm-q1');
    expect(result.feed).toMatchObject({
      status: 'found',
      record: {
        event: { id: eventFile.event.id },
        posts: [{ id: 'post-a' }, { id: 'post-b' }],
      },
    });
  });

  it('does not substitute a different contest or a future feed', () => {
    const newerContest = { ...archive.contests[0], id: 'newer', date: '2024-03-02' };
    const futureEvent = {
      ...eventFile,
      event: { ...eventFile.event, date: '2024-03-03' },
    };
    const noFeed = selectMediaPageData(
      { status: 'ready', data: { ...archive, contests: [newerContest] } },
      { status: 'ready', data: { ...media, events: [eventFile, futureEvent] } },
      instant,
    );
    expect(noFeed.latestContest?.id).toBe('newer');
    expect(noFeed.feed).toEqual({ status: 'not-found' });
  });

  it('lists only held contests with referenced posts and resolves explicit contest selections', () => {
    const previousContest = {
      ...archive.contests[0],
      id: '2023-gpm-q1',
      seasonYear: 2023,
      date: '2023-03-01',
    };
    const previousEvent = {
      ...eventFile,
      event: {
        ...eventFile.event,
        id: '2023-gpm-event',
        contestId: previousContest.id,
        date: '2023-03-01',
      },
    };
    const data = selectMediaPageData(
      { status: 'ready', data: { ...archive, contests: [archive.contests[0], previousContest] } },
      { status: 'ready', data: { ...media, events: [eventFile, previousEvent] } },
      instant,
      previousContest.id,
    );

    expect(data.latestContest?.id).toBe(archive.contests[0].id);
    expect(data.selectedContest?.id).toBe(previousContest.id);
    expect(data.feed).toMatchObject({
      status: 'found',
      record: { event: { id: '2023-gpm-event' }, posts: [{ id: 'post-a' }, { id: 'post-b' }] },
    });
    expect(data.contestsWithMedia.map(({ contest }) => contest.id)).toEqual([
      archive.contests[0].id,
      previousContest.id,
    ]);
  });

  it('rejects future or missing contest selections rather than falling back to the latest contest', () => {
    const data = selectMediaPageData(
      { status: 'ready', data: archive },
      { status: 'ready', data: media },
      instant,
      'not-in-archive',
    );

    expect(data.latestContest?.id).toBe(archive.contests[0].id);
    expect(data.selectedContest).toBeUndefined();
    expect(data.selectionError).toBe('not-found');
    expect(data.feed).toEqual({ status: 'not-found' });
  });

  it('does not apply the default contest when the URL repeats its selection', () => {
    const data = selectMediaPageData(
      { status: 'ready', data: archive },
      { status: 'ready', data: media },
      instant,
      undefined,
      true,
    );

    expect(data.selectedContest).toBeUndefined();
    expect(data.selectionError).toBe('repeated');
    expect(data.feed).toEqual({ status: 'not-found' });
  });

  it('preserves empty event, missing archive, and repository error states', () => {
    const emptyEvent = {
      ...eventFile,
      event: { ...eventFile.event, postIds: [] },
      posts: [],
    };
    expect(
      selectMediaPageData(
        { status: 'ready', data: archive },
        { status: 'ready', data: { ...media, events: [emptyEvent] } },
        instant,
      ).feed,
    ).toMatchObject({ status: 'found', record: { posts: [] } });
    expect(
      selectMediaPageData(
        {
          status: 'empty',
          data: { source: 'archive', schools: [], teams: [], contests: [], seasonStandings: [] },
        },
        { status: 'empty', data: { source: 'archive', events: [] } },
        instant,
      ),
    ).toMatchObject({ latestContest: undefined, feed: { status: 'not-found' } });
    expect(
      selectMediaPageData(
        { status: 'invalid', issues: [] },
        { status: 'empty', data: { source: 'archive', events: [] } },
        instant,
      ),
    ).toMatchObject({ media: { status: 'blocked' }, feed: { status: 'not-found' } });
  });
});
