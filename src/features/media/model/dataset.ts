import type { ValidationIssue } from '@/lib/validation/issues';

import type { EventFile } from './schemas';

export interface MediaDataFile {
  file: string;
  record: EventFile;
}

export interface MediaDataset {
  events: MediaDataFile[];
}

/**
 * Checks that span several files: event and post ids must be unique across the whole feed, and
 * every post referenced by an event must exist in the same file.
 */
export const validateMediaReferences = (
  dataset: MediaDataset,
  contestIds: ReadonlySet<string>,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const seenEventIds = new Map<string, string>();
  const seenPostIds = new Map<string, string>();

  dataset.events.forEach(({ file, record }) => {
    const existingEvent = seenEventIds.get(record.event.id);

    if (existingEvent === undefined) {
      seenEventIds.set(record.event.id, file);
    } else {
      issues.push({
        file,
        location: 'event.id',
        message: `duplicate event id \`${record.event.id}\`, already defined in ${existingEvent}`,
      });
    }

    record.posts.forEach((post, index) => {
      const existingPost = seenPostIds.get(post.id);

      if (existingPost === undefined) {
        seenPostIds.set(post.id, file);
        return;
      }

      issues.push({
        file,
        location: `posts[${String(index)}].id`,
        message: `duplicate post id \`${post.id}\`, already defined in ${existingPost}`,
      });
    });

    const postIds = new Set(record.posts.map((post) => post.id));

    record.event.postIds.forEach((postId, index) => {
      if (!postIds.has(postId)) {
        issues.push({
          file,
          location: `event.postIds[${String(index)}]`,
          message: `unknown post \`${postId}\``,
        });
      }
    });

    if (record.event.contestId !== undefined && !contestIds.has(record.event.contestId)) {
      issues.push({
        file,
        location: 'event.contestId',
        message: `unknown contest \`${record.event.contestId}\``,
      });
    }

    const referenced = new Set(record.event.postIds);

    record.posts.forEach((post, index) => {
      if (!referenced.has(post.id)) {
        issues.push({
          file,
          location: `posts[${String(index)}].id`,
          message: `post \`${post.id}\` is not listed in the event's postIds, so it would never be shown`,
        });
      }
    });
  });

  return issues;
};
