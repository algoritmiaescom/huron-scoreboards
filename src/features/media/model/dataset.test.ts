import { describe, expect, it } from 'vitest';

import { validateMediaReferences, type MediaDataset } from './dataset';

const dataset: MediaDataset = {
  events: [
    {
      file: 'data/media/events/2024-gpm.json',
      record: {
        event: {
          id: 'gpm-event',
          name: 'GPM 2024',
          date: '2024-03-10',
          hashtag: '#GPM2024',
          contestId: 'missing-contest',
          postIds: ['missing-post'],
        },
        posts: [
          {
            id: 'shared-post',
            source: 'x',
            author: { username: 'huron-club' },
            postedAt: '2024-03-10T15:00:00-06:00',
            body: 'GPM 2024 starts now.',
            media: [
              {
                type: 'image',
                url: 'https://example.com/image-1.jpg',
                alt: 'Contest start photo',
              },
            ],
            permalink: 'https://example.com/posts/1',
            tags: ['#GPM2024'],
          },
        ],
      },
    },
    {
      file: 'data/media/events/2024-finals.json',
      record: {
        event: {
          id: 'gpm-event',
          name: 'Finals 2024',
          date: '2024-04-01',
          hashtag: '#Finals2024',
          contestId: 'contest-2',
          postIds: ['shared-post'],
        },
        posts: [
          {
            id: 'shared-post',
            source: 'instagram',
            author: { username: 'huron-club' },
            postedAt: '2024-04-01T15:00:00-06:00',
            body: 'Finals are here.',
            media: [
              {
                type: 'image',
                url: 'https://example.com/image-2.jpg',
                alt: 'Finals photo',
              },
            ],
            permalink: 'https://example.com/posts/2',
            tags: ['#Finals2024'],
          },
        ],
      },
    },
  ],
};

describe('validateMediaReferences', () => {
  it('reports duplicate ids and unresolved references', () => {
    expect(validateMediaReferences(dataset, new Set(['contest-2']))).toEqual(
      expect.arrayContaining([
        {
          file: 'data/media/events/2024-finals.json',
          location: 'event.id',
          message:
            'duplicate event id `gpm-event`, already defined in data/media/events/2024-gpm.json',
        },
        {
          file: 'data/media/events/2024-finals.json',
          location: 'posts[0].id',
          message:
            'duplicate post id `shared-post`, already defined in data/media/events/2024-gpm.json',
        },
        {
          file: 'data/media/events/2024-gpm.json',
          location: 'event.postIds[0]',
          message: 'unknown post `missing-post`',
        },
        {
          file: 'data/media/events/2024-gpm.json',
          location: 'event.contestId',
          message: 'unknown contest `missing-contest`',
        },
        {
          file: 'data/media/events/2024-gpm.json',
          location: 'posts[0].id',
          message:
            "post `shared-post` is not listed in the event's postIds, so it would never be shown",
        },
      ]),
    );
  });
});
