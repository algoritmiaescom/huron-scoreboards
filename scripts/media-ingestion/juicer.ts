import { setTimeout } from 'node:timers/promises';
import axios, { type AxiosAdapter, type AxiosInstance, type AxiosResponse } from 'axios';
import { z } from 'zod';

import { type PostSource } from '@/features/media/model/schemas';

import { type EventConfig, type IngestionConfig, type SourceConfig } from './config';

const httpUrl = z.httpUrl();
const optionalText = z.string().nullable().optional();
const wirePostSchema = z.object({
  platform: z.string().min(1),
  external_id: optionalText,
  platform_id: optionalText,
  url: httpUrl,
  message: z.string().trim().min(1),
  external_created_at: z.iso.datetime({ offset: true }).optional(),
  post_created_at: z.iso.datetime({ offset: true }).optional(),
  poster: z.object({
    name: z.string().trim().min(1),
    display_name: optionalText,
    url: httpUrl.nullable().optional(),
    image: httpUrl.nullable().optional(),
  }),
  media: z.array(
    z.object({
      type: z.enum(['image', 'video', 'link']),
      url: httpUrl,
      alt_text: optionalText,
    }),
  ),
  moderation_status: z.literal('public').optional(),
});

const feedPageSchema = z.object({
  data: z.array(wirePostSchema),
  meta: z.object({
    page: z.number().int().positive(),
    total_pages: z.number().int().nonnegative(),
  }),
});

const dataPageSchema = z.object({
  data: z.array(wirePostSchema),
  meta: z.object({
    platforms: z.array(
      z.object({
        platform: z.string().min(1),
        success: z.boolean(),
        has_more: z.boolean().optional(),
        next_cursor: z.string().min(1).nullable().optional(),
      }),
    ),
  }),
});

export type WirePost = z.infer<typeof wirePostSchema>;
export interface CollectedPost {
  post: WirePost;
  source: PostSource;
  postedAt: string;
  externalId?: string;
}

const platformNames: Record<PostSource, string> = {
  x: 'Twitter',
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
};

export const toPostSource = (platform: string): PostSource => {
  const normalized = platform.toLowerCase();
  if (normalized === 'twitter' || normalized === 'x') {
    return 'x';
  }
  if (
    normalized === 'instagram' ||
    normalized === 'facebook' ||
    normalized === 'youtube' ||
    normalized === 'linkedin'
  ) {
    return normalized;
  }
  throw new Error('Juicer returned an unsupported platform');
};

export interface ClientDependencies {
  adapter?: AxiosAdapter;
  sleep?: (milliseconds: number) => Promise<unknown>;
}

export type JuicerClientConfig = Pick<
  IngestionConfig,
  'retries' | 'maxRequests' | 'maxPages' | 'requestTimeoutMs'
>;

export class JuicerClient {
  private readonly config: JuicerClientConfig;
  private readonly http: AxiosInstance;
  private readonly sleep: (milliseconds: number) => Promise<unknown>;
  private requests = 0;

  constructor(config: JuicerClientConfig, apiKey: string, dependencies: ClientDependencies = {}) {
    if (apiKey.trim().length === 0 || /[\r\n]/.test(apiKey)) {
      throw new Error('JUICER_API_KEY must be a nonempty, single-line key');
    }
    this.config = config;
    this.sleep = dependencies.sleep ?? setTimeout;
    this.http = axios.create({
      adapter: dependencies.adapter,
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      timeout: config.requestTimeoutMs,
      maxRedirects: 0,
      responseType: 'text',
      transformResponse: [],
      validateStatus: () => true,
    });
  }

  private readonly request = async (url: URL): Promise<unknown> => {
    const { config } = this;
    for (let attempt = 0; attempt <= config.retries; attempt += 1) {
      this.requests += 1;
      if (this.requests > config.maxRequests) {
        throw new Error('Juicer request limit reached; increase maxRequests or narrow the sources');
      }
      let response: AxiosResponse<string>;
      try {
        response = await this.http.get<string>(url.toString());
      } catch {
        if (attempt === config.retries) {
          throw new Error('Juicer network request failed or timed out');
        }
        await this.sleep(1000 * 2 ** attempt);
        continue;
      }
      if (response.status === 429 || response.status >= 500) {
        if (attempt === config.retries) {
          throw new Error(`Juicer HTTP ${String(response.status)} after retries`);
        }
        const header: unknown = response.headers['retry-after'];
        const retryAfter = typeof header === 'string' ? header : null;
        const seconds = retryAfter === null ? NaN : Number(retryAfter);
        const delay =
          retryAfter === null
            ? 1000 * 2 ** attempt
            : Number.isFinite(seconds)
              ? seconds * 1000
              : Date.parse(retryAfter) - Date.now();
        if (!Number.isFinite(delay) || delay > 60_000) {
          throw new Error('Juicer Retry-After exceeds the retry budget or is invalid; retry later');
        }
        await this.sleep(Math.max(0, delay));
        continue;
      }
      if (response.status < 200 || response.status >= 300) {
        throw new Error(
          `Juicer HTTP ${String(response.status)}; check access and source configuration`,
        );
      }
      try {
        const data: unknown = JSON.parse(response.data);
        return data;
      } catch {
        throw new Error('Juicer returned invalid JSON');
      }
    }
    throw new Error('Juicer retry budget exhausted');
  };

  readonly collect = async (
    source: SourceConfig,
    event: EventConfig,
    defaultHashtag: string,
  ): Promise<CollectedPost[]> => {
    const { config } = this;
    const collected: CollectedPost[] = [];
    // Query one platform at a time so cursors can never be applied to the wrong platform.
    const platforms = source.platforms ?? [undefined];
    const terms = source.type === 'hashtag' ? (source.hashtags ?? [defaultHashtag]) : [undefined];
    const queries = terms.flatMap((term) => platforms.map((platform) => ({ term, platform })));
    for (const { term, platform } of queries) {
      let cursor: string | undefined;
      const seenCursors = new Set<string>();
      let complete = false;
      for (let page = 1; page <= config.maxPages; page += 1) {
        const url = new URL(
          source.type === 'feed' ? `feeds/${String(source.feedId)}/posts` : 'data/posts',
          'https://api.juicer.io/v1/',
        );
        if (platform !== undefined) {
          url.searchParams.set(
            source.type === 'feed' ? 'filter' : 'platforms',
            platformNames[platform],
          );
        }
        if (source.type === 'feed') {
          if (source.sourceIds !== undefined) {
            url.searchParams.set('filter', source.sourceIds.join(','));
          }
          url.searchParams.set('status', 'public');
          url.searchParams.set('page', String(page));
          url.searchParams.set('per_page', '100');
          if (event.startingAt !== undefined) {
            url.searchParams.set('starting_at', event.startingAt);
          }
          if (event.endingAt !== undefined) {
            url.searchParams.set('ending_at', event.endingAt);
          }
        } else if (term !== undefined) {
          url.searchParams.set('term', term);
          url.searchParams.set('term_type', 'hashtag');
          if (cursor !== undefined) {
            url.searchParams.set('cursor', cursor);
          }
        }
        const raw = await this.request(url);
        const result =
          source.type === 'feed' ? feedPageSchema.safeParse(raw) : dataPageSchema.safeParse(raw);
        if (!result.success) {
          const locations = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
          throw new Error(`Invalid Juicer ${source.type} response at ${locations}`);
        }
        const response = result.data;
        for (const post of response.data) {
          const postSource = toPostSource(post.platform);
          if (platform !== undefined && postSource !== platform) {
            throw new Error('Juicer returned a post outside the requested platform');
          }
          const postedAt = source.type === 'feed' ? post.external_created_at : post.post_created_at;
          if (postedAt === undefined) {
            throw new Error('Juicer post is missing its publication timestamp');
          }
          collected.push({
            post,
            source: postSource,
            postedAt,
            externalId: (source.type === 'feed' ? post.external_id : post.platform_id) ?? undefined,
          });
        }
        if ('total_pages' in response.meta) {
          if (response.meta.page !== page) {
            throw new Error('Juicer returned an unexpected feed page');
          }
          complete = page >= response.meta.total_pages;
        } else {
          const statuses = response.meta.platforms;
          const status = statuses[0];
          if (
            statuses.length !== 1 ||
            !status.success ||
            toPostSource(status.platform) !== platform
          ) {
            throw new Error('Juicer reported a platform failure or missing platform status');
          }
          if (status.has_more === undefined || status.next_cursor === undefined) {
            throw new Error('Juicer omitted platform pagination status');
          }
          complete = !status.has_more;
          if (status.has_more !== (status.next_cursor !== null)) {
            throw new Error('Juicer returned inconsistent pagination status');
          }
          if (status.next_cursor !== null) {
            cursor = status.next_cursor;
            if (seenCursors.has(cursor)) {
              throw new Error('Juicer repeated a pagination cursor');
            }
            seenCursors.add(cursor);
          }
        }
        if (complete) {
          break;
        }
      }
      if (!complete) {
        throw new Error('Juicer page limit reached; increase maxPages or narrow the sources');
      }
    }
    return collected;
  };
}
