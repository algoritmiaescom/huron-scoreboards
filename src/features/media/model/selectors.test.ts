import { describe, expect, it } from 'vitest';

import { eventFile } from '@/test/fixtures/archive';

import { selectContestFeed } from './selectors';

describe('contest feed selectors', () => {
  it('preserves curated post order and does not require optional metadata or media', () => {
    const result = selectContestFeed(
      { source: 'mock', events: [eventFile] },
      '2024-gpm-q1',
      '2024-03-01',
    );
    if (result.status !== 'found') {
      throw new Error('Expected feed');
    }
    expect(result.record.posts.map(({ id }) => id)).toEqual(['post-a', 'post-b']);
    expect(result.record.posts[0].author.displayName).toBeUndefined();
    expect(result.record.posts[0].media).toEqual([]);
    expect(result.record.event.location).toBeUndefined();
  });

  it('chooses the latest held linked event then ascending id, ignoring future and unlinked events', () => {
    const selected = {
      ...eventFile,
      event: { ...eventFile.event, id: 'a', date: '2024-03-02' },
    };
    const result = selectContestFeed(
      {
        source: 'mock',
        events: [
          eventFile,
          { ...selected, event: { ...selected.event, id: 'z' } },
          selected,
          { ...selected, event: { ...selected.event, id: 'future', date: '2024-03-03' } },
          { ...selected, event: { ...selected.event, id: 'unlinked', contestId: undefined } },
        ],
      },
      '2024-gpm-q1',
      '2024-03-02',
    );
    expect(result).toMatchObject({ status: 'found', record: { event: { id: 'a' } } });
  });

  it('distinguishes absent feeds from an existing event with zero posts', () => {
    expect(
      selectContestFeed({ source: 'mock', events: [eventFile] }, 'unknown', '2024-03-01'),
    ).toEqual({ status: 'not-found' });
    expect(
      selectContestFeed({ source: 'mock', events: [eventFile] }, '2024-gpm-q1', '2024-02-01'),
    ).toEqual({ status: 'not-found' });
    expect(
      selectContestFeed(
        {
          source: 'mock',
          events: [{ event: { ...eventFile.event, postIds: [] }, posts: [] }],
        },
        '2024-gpm-q1',
        '2024-03-01',
      ),
    ).toMatchObject({ status: 'found', record: { posts: [] } });
  });

  it('fails explicitly if a caller bypasses post-reference validation', () => {
    expect(() =>
      selectContestFeed(
        {
          source: 'mock',
          events: [{ ...eventFile, posts: [] }],
        },
        '2024-gpm-q1',
        '2024-03-01',
      ),
    ).toThrow('Unresolved post');
  });
});
