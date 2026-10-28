import { findRecord, type RecordResult } from '@/lib/data/repository';

import type { EventFile } from './schemas';
import type { MediaArchive } from '../repositories/mediaRepository';

export const selectEvent = (archive: MediaArchive, id: string): RecordResult<EventFile> =>
  findRecord(archive.events.find(({ event }) => event.id === id));

export const selectContestFeed = (archive: MediaArchive, contestId: string, today: string) => {
  const selected = archive.events
    .filter(({ event }) => event.contestId === contestId && event.date <= today)
    .toSorted(
      (a, b) => b.event.date.localeCompare(a.event.date) || a.event.id.localeCompare(b.event.id),
    )
    .at(0);
  if (selected === undefined) {
    return { status: 'not-found' as const };
  }
  const postsById = new Map(selected.posts.map((post) => [post.id, post]));
  const posts = selected.event.postIds.map((id) => {
    const post = postsById.get(id);
    if (post === undefined) {
      throw new Error(`Unresolved post ${id}; selectors require a validated archive.`);
    }
    return post;
  });
  return {
    status: 'found' as const,
    record: { event: selected.event, posts },
  };
};
