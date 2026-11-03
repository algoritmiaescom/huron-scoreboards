import { setTimeout } from 'node:timers/promises';

import axios, { type AxiosAdapter, type AxiosInstance, type AxiosResponse } from 'axios';
import { z } from 'zod';

import { type PostSource } from '@/features/media/model/schemas';

import { type EventConfig, type IngestionConfig, type SourceConfig } from './config';

const httpUrl = z.httpUrl();
const optionalText = z.string().nullable().optional();
const wirePostSchema = z
  .object({
    platform: z.string().min(1),
    external_id: optionalText,
    platform_id: optionalText,
    url: httpUrl,
    message: z
      .string()
      .trim()
      .nullable()
      .transform((message) => message ?? ''),
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
  })
  .refine((post) => post.message.length > 0 || post.media.some(({ type }) => type !== 'link'), {
    path: ['message'],
    message: 'must contain text or image/video media',
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
        error_code: z.string().optional(),
        message: z.string().optional(),
        has_more: z.boolean().optional(),
        next_cursor: z.string().min(1).nullable().optional(),
      }),
    ),
  }),
});

const errorBodySchema = z.object({
  error: z.object({
    code: z.string().optional(),
    message: z.string().optional(),
    action: z.object({ checkout_url: z.string().optional() }).optional(),
  }),
});

const clip = (text: string, length = 300) =>
  text.length > length ? `${text.slice(0, length)}…` : text;

const statusHints: Partial<Record<number, string>> = {
  401: 'JUICER_API_KEY is missing, invalid, or expired; use a permanent key from the Juicer dashboard',
  402: 'the Juicer account is out of API credits; direct hashtag sources spend Data API credits per request, so top up the balance or remove hashtag sources',
  403: 'the API key cannot access this resource; check the feed belongs to this Juicer account',
  404: 'not found; feedId must be the numeric feed ID from the Juicer API, not the feed slug',
  422: 'Juicer rejected the request parameters; check the source platforms, hashtags, and dates',
};

export class JuicerHttpError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, body: string) {
    let detail = '';
    let action = '';
    let code: string | undefined;
    // Juicer reports errors as `{ error: { code, message, action } }`; anything else is not echoed.
    try {
      const parsed = errorBodySchema.safeParse(JSON.parse(body));
      if (parsed.success) {
        const { message, action: next } = parsed.data.error;
        code = parsed.data.error.code;
        detail = [code, message === undefined ? undefined : clip(message.replace(/[.\s]+$/, ''))]
          .filter((part) => part !== undefined)
          .join(': ');
        action = next?.checkout_url === undefined ? '' : ` (${clip(next.checkout_url)})`;
      }
    } catch {
      // Non-JSON error bodies are omitted.
    }
    const hint = statusHints[status] ?? 'check access and source configuration';
    super(
      `Juicer HTTP ${String(status)}${detail === '' ? '' : ` ${detail}`}. Hint: ${hint}${action}`,
    );
    this.name = 'JuicerHttpError';
    this.status = status;
    this.code = code;
  }
}

const describeRequest = (url: URL): string => {
  const params = new URLSearchParams(url.searchParams);
  if (params.has('cursor')) {
    params.set('cursor', '…');
  }
  const query = decodeURIComponent(params.toString());
  return `GET ${url.pathname}${query === '' ? '' : `?${query}`}`;
};

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
  throw new Error(
    `Juicer returned an unsupported platform "${clip(platform, 40)}"; filter the feed with platforms or sourceIds`,
  );
};

export interface ClientDependencies {
  adapter?: AxiosAdapter;
  sleep?: (milliseconds: number) => Promise<unknown>;
  // Receives one line per HTTP attempt; never includes credentials.
  log?: (line: string) => void;
}

export type JuicerClientConfig = Pick<
  IngestionConfig,
  'retries' | 'maxRequests' | 'maxPages' | 'requestTimeoutMs'
>;

export interface IncompleteQuery {
  // For example `hashtag #ICPC, platform x`.
  query: string;
  reason: string;
  page: number;
  retained: number;
}

export class JuicerClient {
  private readonly config: JuicerClientConfig;
  private readonly http: AxiosInstance;
  private readonly sleep: (milliseconds: number) => Promise<unknown>;
  private readonly log: (line: string) => void;
  private readonly apiKey: string;
  private requests = 0;
  // A 402 is account-wide, so later queries of the same source type are skipped without spending requests.
  private readonly outOfCredits = new Set<SourceConfig['type']>();

  constructor(config: JuicerClientConfig, apiKey: string, dependencies: ClientDependencies = {}) {
    if (apiKey.trim().length === 0 || /[\r\n]/.test(apiKey)) {
      throw new Error('JUICER_API_KEY must be a nonempty, single-line key');
    }
    this.config = config;
    this.sleep = dependencies.sleep ?? setTimeout;
    this.log = dependencies.log ?? (() => undefined);
    this.apiKey = apiKey;
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
    const label = describeRequest(url);
    for (let attempt = 0; attempt <= config.retries; attempt += 1) {
      if (this.requests >= config.maxRequests) {
        throw new Error(
          `Juicer request limit reached after ${String(config.maxRequests)} requests; increase maxRequests or narrow the sources`,
        );
      }
      this.requests += 1;
      const attemptLabel = `${label} (attempt ${String(attempt + 1)}/${String(config.retries + 1)})`;
      const started = performance.now();
      let response: AxiosResponse<string>;
      try {
        response = await this.http.get<string>(url.toString());
      } catch (error) {
        const reason = axios.isAxiosError(error) && error.code !== undefined ? error.code : 'error';
        this.log(`${attemptLabel} -> ${reason}`);
        if (attempt === config.retries) {
          throw new Error(
            `Juicer network request failed or timed out (${reason}) after ${String(attempt + 1)} attempt(s); check connectivity or increase requestTimeoutMs`,
          );
        }
        await this.sleep(1000 * 2 ** attempt);
        continue;
      }
      this.log(
        `${attemptLabel} -> HTTP ${String(response.status)} in ${String(Math.round(performance.now() - started))} ms`,
      );
      if (response.status === 429 || response.status >= 500) {
        if (attempt === config.retries) {
          const error = new JuicerHttpError(response.status, response.data);
          error.message += ` (gave up after ${String(attempt + 1)} attempt(s); retry later)`;
          throw error;
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
        throw new JuicerHttpError(response.status, response.data);
      }
      try {
        const data: unknown = JSON.parse(response.data);
        return data;
      } catch {
        throw new Error(`Juicer returned invalid JSON (HTTP ${String(response.status)})`);
      }
    }
    throw new Error('Juicer retry budget exhausted');
  };

  private readonly collectQuery = async (
    source: SourceConfig,
    event: EventConfig,
    term: string | undefined,
    platform: PostSource | undefined,
    progress: { page: number },
    collected: CollectedPost[],
  ): Promise<void> => {
    const { config } = this;
    let cursor: string | undefined;
    const seenCursors = new Set<string>();
    let complete = false;
    for (let page = 1; page <= config.maxPages; page += 1) {
      progress.page = page;
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
        const issues = result.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
          .join('; ');
        const more = result.error.issues.length > 5 ? '; …' : '';
        throw new Error(`Invalid Juicer ${source.type} response: ${issues}${more}`);
      }
      const response = result.data;
      const pagePosts: CollectedPost[] = [];
      for (const [index, post] of response.data.entries()) {
        const postSource = toPostSource(post.platform);
        if (platform !== undefined && postSource !== platform) {
          throw new Error(
            `Juicer returned a ${postSource} post outside the requested platform ${platform}: ${post.url}`,
          );
        }
        const postedAt = source.type === 'feed' ? post.external_created_at : post.post_created_at;
        if (postedAt === undefined) {
          throw new Error(
            `Juicer post ${String(index)} is missing its publication timestamp: ${post.url}`,
          );
        }
        pagePosts.push({
          post,
          source: postSource,
          postedAt,
          externalId: (source.type === 'feed' ? post.external_id : post.platform_id) ?? undefined,
        });
      }
      if ('total_pages' in response.meta) {
        if (response.meta.page !== page) {
          throw new Error(
            `Juicer returned feed page ${String(response.meta.page)} when page ${String(page)} was requested`,
          );
        }
        complete = page >= response.meta.total_pages;
      } else {
        const statuses = response.meta.platforms;
        if (statuses.length !== 1) {
          throw new Error(
            `Juicer returned ${String(statuses.length)} platform statuses; expected exactly one`,
          );
        }
        const status = statuses[0];
        if (!status.success) {
          const detail = [status.error_code, status.message]
            .filter((part) => part !== undefined)
            .map((part) => clip(part))
            .join(': ');
          throw new Error(
            `Juicer reported a ${status.platform} platform failure${detail === '' ? '' : ` (${detail})`}. Hint: timeouts are often transient; rerun later`,
          );
        }
        if (toPostSource(status.platform) !== platform) {
          throw new Error(
            `Juicer returned platform status for ${status.platform} instead of the requested platform`,
          );
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
      collected.push(...pagePosts);
      if (complete) {
        break;
      }
    }
    if (!complete) {
      const hint =
        source.type === 'feed'
          ? 'increase maxPages, set startingAt, or narrow the sources'
          : 'increase maxPages or narrow the sources (date bounds filter locally and do not reduce hashtag pagination)';
      throw new Error(`Juicer page limit reached after ${String(config.maxPages)} pages; ${hint}`);
    }
  };

  // Without a reporter, collections remain strict. Opting in retains only fully validated pages.
  readonly collect = async (
    source: SourceConfig,
    event: EventConfig,
    defaultHashtag: string,
    onIncomplete?: (failure: IncompleteQuery) => void,
  ): Promise<CollectedPost[]> => {
    const collected: CollectedPost[] = [];
    // Query one platform at a time so cursors can never be applied to the wrong platform.
    const platforms = source.platforms ?? [undefined];
    const terms = source.type === 'hashtag' ? (source.hashtags ?? [defaultHashtag]) : [undefined];
    const queries = terms.flatMap((term) => platforms.map((platform) => ({ term, platform })));
    for (const { term, platform } of queries) {
      const progress = { page: 1 };
      const query = [
        source.type === 'feed' ? `feed ${String(source.feedId)}` : `hashtag ${term ?? ''}`,
        platform === undefined ? 'all platforms' : `platform ${platform}`,
      ].join(', ');
      if (onIncomplete !== undefined && this.outOfCredits.has(source.type)) {
        onIncomplete({
          query,
          reason: 'Juicer API credits exhausted earlier in this run; not requested',
          page: 1,
          retained: 0,
        });
        continue;
      }
      const queryPosts: CollectedPost[] = [];
      try {
        await this.collectQuery(source, event, term, platform, progress, queryPosts);
      } catch (error) {
        const message = (error instanceof Error ? error.message : String(error)).replaceAll(
          this.apiKey,
          '[REDACTED]',
        );
        if (onIncomplete !== undefined) {
          if (error instanceof JuicerHttpError && error.status === 402) {
            this.outOfCredits.add(source.type);
          }
          collected.push(...queryPosts);
          onIncomplete({
            query,
            reason: message,
            page: progress.page,
            retained: queryPosts.length,
          });
          continue;
        }
        throw new Error(
          `[event ${event.eventId}, ${query}, page ${String(progress.page)}] ${message}`,
          { cause: error },
        );
      }
      collected.push(...queryPosts);
    }
    return collected;
  };
}
