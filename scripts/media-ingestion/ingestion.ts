import { createHash, randomUUID } from 'node:crypto';
import { readFile, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { format, resolveConfig } from 'prettier';
import { z } from 'zod';

import {
  type EventFile,
  eventFileSchema,
  eventSchema,
  type Post,
  postAuthorSchema,
  postMediaSchema,
  postSchema,
} from '@/features/media/model/schemas';
import { formatIssues } from '@/lib/validation/issues';

import { validateDataDirectory } from '../data-validation';
import { type EventConfig, type IngestionConfig, parseJson, type SourceConfig } from './config';
import { type ClientDependencies, type CollectedPost, JuicerClient } from './juicer';

// Validate known fields without erasing contributor metadata during append-only updates.
const archiveSchema = eventFileSchema.loose().extend({
  event: eventSchema.loose(),
  posts: z.array(
    postSchema.loose().extend({
      author: postAuthorSchema.loose(),
      media: z.array(postMediaSchema.loose()),
    }),
  ),
});

export const canonicalPermalink = (value: string): string => {
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Post permalinks must use HTTP or HTTPS');
  }
  if (url.hostname === 'twitter.com' || url.hostname === 'www.twitter.com') {
    url.hostname = 'x.com';
  }
  url.hostname = url.hostname.replace(/^www\./, '');
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith('utm_') || ['fbclid', 'igsh', 'igshid', 's', 't'].includes(key)) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.toString();
};

export const normalizePost = (item: CollectedPost, eventId: string): Post => {
  const { post, source, postedAt, externalId } = item;
  const identity =
    externalId === undefined || externalId.trim() === ''
      ? canonicalPermalink(post.url)
      : externalId.trim();
  const digest = createHash('sha256').update(`${source}:${identity}`).digest('hex');
  return postSchema.parse({
    id: `${eventId}-${source}-${digest}`,
    source,
    author: {
      username: post.poster.name,
      ...(post.poster.display_name ? { displayName: post.poster.display_name } : {}),
      ...(post.poster.url ? { profileUrl: post.poster.url } : {}),
      ...(post.poster.image ? { avatarUrl: post.poster.image } : {}),
    },
    postedAt,
    body: post.message,
    media: post.media.flatMap((medium) =>
      medium.type === 'link'
        ? []
        : [{ type: medium.type, url: medium.url, alt: medium.alt_text ?? '' }],
    ),
    permalink: post.url,
    tags: [...new Set(post.message.match(/#[\p{L}\p{N}_]+/gu) ?? [])],
  });
};

export interface EventSummary {
  eventId: string;
  sources: SourceConfig['type'][];
  fetched: number;
  added: number;
  duplicates: number;
  suppressed: number;
  outsideDateRange: number;
  missingAlt: number;
  // Source queries skipped because Juicer rejected them for exhausted credits.
  skipped: string[];
}

export const appendPosts = (
  existing: EventFile,
  candidates: CollectedPost[],
  config: EventConfig,
) => {
  const summary: EventSummary = {
    eventId: config.eventId,
    sources: [...new Set(config.sources.map(({ type }) => type))],
    fetched: candidates.length,
    skipped: [],
    added: 0,
    duplicates: 0,
    suppressed: 0,
    outsideDateRange: 0,
    missingAlt: 0,
  };
  const ids = new Set(existing.posts.map(({ id }) => id));
  const links = new Set(existing.posts.map(({ permalink }) => canonicalPermalink(permalink)));
  const suppressed = new Set(config.suppressedPermalinks.map(canonicalPermalink));
  const additions: Post[] = [];
  for (const candidate of candidates) {
    const timestamp = Date.parse(candidate.postedAt);
    if (
      (config.startingAt !== undefined && timestamp < Date.parse(config.startingAt)) ||
      (config.endingAt !== undefined && timestamp > Date.parse(config.endingAt))
    ) {
      summary.outsideDateRange += 1;
      continue;
    }
    const link = canonicalPermalink(candidate.post.url);
    if (suppressed.has(link)) {
      summary.suppressed += 1;
      continue;
    }
    const post = normalizePost(candidate, config.eventId);
    if (ids.has(post.id) || links.has(link)) {
      summary.duplicates += 1;
      continue;
    }
    ids.add(post.id);
    links.add(link);
    additions.push(post);
  }
  additions.sort(
    (a, b) => Date.parse(a.postedAt) - Date.parse(b.postedAt) || a.id.localeCompare(b.id, 'en'),
  );
  summary.added = additions.length;
  summary.missingAlt = additions.reduce(
    (total, post) => total + post.media.filter(({ alt }) => alt.trim().length === 0).length,
    0,
  );
  return {
    record: {
      ...existing,
      event: {
        ...existing.event,
        postIds: [...existing.event.postIds, ...additions.map(({ id }) => id)],
      },
      posts: [...existing.posts, ...additions],
    },
    summary,
  };
};

export const ingestMedia = async ({
  root,
  config,
  apiKey,
  dryRun = false,
  dependencies,
  onWarning,
}: {
  root: string;
  config: IngestionConfig;
  apiKey: string;
  dryRun?: boolean;
  dependencies?: ClientDependencies;
  onWarning?: (warning: string) => void;
}): Promise<EventSummary[]> => {
  if (config.events.length === 0) {
    throw new Error(
      'No events configured; add a real event and configure its Juicer sources first',
    );
  }
  const client = new JuicerClient(config, apiKey, dependencies);
  const baseline = await validateDataDirectory(root);
  if (baseline.issues.length > 0) {
    throw new Error(formatIssues(baseline.issues));
  }
  const targets = await Promise.all(
    config.events.map(async (eventConfig) => {
      const file = `data/media/events/${eventConfig.eventId}.json`;
      const absolutePath = path.join(root, file);
      // Reject symlinked directories and files as well as traversal in the config's slug IDs.
      if ((await realpath(absolutePath)) !== path.resolve(root, file)) {
        throw new Error(`Ingestion target must not be a symlink: ${file}`);
      }
      const contents = await readFile(absolutePath, 'utf8');
      const result = archiveSchema.safeParse(parseJson(contents, file));
      if (!result.success || result.data.event.id !== eventConfig.eventId) {
        throw new Error(`Invalid event record or mismatched event ID: ${file}`);
      }
      return { file, absolutePath, contents, existing: result.data, eventConfig };
    }),
  );
  const proposals = [];
  for (const target of targets) {
    const candidates: CollectedPost[] = [];
    const skipped: string[] = [];
    for (const source of target.eventConfig.sources) {
      candidates.push(
        ...(await client.collect(
          source,
          target.eventConfig,
          target.existing.event.hashtag,
          ({ query, reason }) => {
            skipped.push(query);
            onWarning?.(`[event ${target.eventConfig.eventId}, ${query}] Skipped: ${reason}`);
          },
        )),
      );
    }
    const { record, summary } = appendPosts(target.existing, candidates, target.eventConfig);
    summary.skipped = skipped;
    eventFileSchema.parse(record);
    proposals.push({ ...target, record, summary });
  }
  const report = await validateDataDirectory(
    root,
    path.join(root, 'data'),
    new Map(proposals.map(({ file, record }) => [file, record])),
  );
  if (report.issues.length > 0) {
    throw new Error(formatIssues(report.issues));
  }
  if (!dryRun) {
    const staged: { temporary: string; destination: string }[] = [];
    try {
      for (const proposal of proposals) {
        if ((await readFile(proposal.absolutePath, 'utf8')) !== proposal.contents) {
          throw new Error(`Event changed during ingestion; retry: ${proposal.file}`);
        }
        if (proposal.summary.added === 0) {
          continue;
        }
        const temporary = `${proposal.absolutePath}.${randomUUID()}.tmp`;
        staged.push({ temporary, destination: proposal.absolutePath });
        const formatted = await format(JSON.stringify(proposal.record), {
          ...(await resolveConfig(proposal.absolutePath)),
          filepath: proposal.absolutePath,
        });
        await writeFile(temporary, formatted, { flag: 'wx' });
      }
      for (const entry of staged) {
        await rename(entry.temporary, entry.destination);
      }
    } finally {
      for (const { temporary } of staged) {
        await unlink(temporary).catch((error: unknown) => {
          if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
            throw error;
          }
        });
      }
    }
  }
  return proposals.map(({ summary }) => summary);
};
