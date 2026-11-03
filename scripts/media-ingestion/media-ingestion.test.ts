// @vitest-environment node
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { type AxiosAdapter, AxiosHeaders, type AxiosResponse } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { postMediaSchema, postSchema } from '@/features/media/model/schemas';

import { configSchema, parseConfig, parseJson, type SourceConfig } from './config';
import {
  appendPosts,
  canonicalPermalink,
  containsHashtag,
  ingestMedia,
  normalizePost,
} from './ingestion';
import { type CollectedPost, type IncompleteQuery, JuicerClient, toPostSource } from './juicer';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map(async (root) => rm(root, { recursive: true, force: true })),
  );
});

const wirePost = (id = '1') => ({
  platform: 'Twitter',
  external_id: id,
  platform_id: id,
  url: `https://x.com/club/status/${id}`,
  message: 'News #ICPC #ICPC #México',
  external_created_at: '2026-10-22T10:00:00Z',
  post_created_at: '2026-10-22T10:00:00Z',
  poster: {
    name: 'club',
    display_name: 'Club',
    url: 'https://x.com/club',
    image: 'https://example.com/avatar.png',
  },
  media: [
    { type: 'image', url: 'https://example.com/image.png', alt_text: null },
    { type: 'video', url: 'https://example.com/video.mp4', alt_text: 'Teams celebrating' },
    { type: 'link', url: 'https://example.com/article', alt_text: null },
  ],
});

const config = (sources: SourceConfig[] = [{ type: 'feed', feedId: 123 }]) =>
  configSchema.parse({ events: [{ eventId: '2026-finals', sources }] });

const eventConfig = () => config().events[0];
const record = () => ({
  event: {
    id: '2026-finals',
    name: 'Finals',
    date: '2026-10-22',
    hashtag: '#ICPC',
    postIds: [] as string[],
  },
  posts: [] as ReturnType<typeof normalizePost>[],
});

const candidate = (id = '1'): CollectedPost => ({
  post: {
    ...wirePost(id),
    media: [
      { type: 'image', url: 'https://example.com/image.png', alt_text: null },
      { type: 'video', url: 'https://example.com/video.mp4', alt_text: 'Teams celebrating' },
      { type: 'link', url: 'https://example.com/article', alt_text: null },
    ],
  },
  source: 'x',
  postedAt: '2026-10-22T10:00:00Z',
  externalId: id,
  searchedHashtag: '#ICPC',
});

const feedPage = (posts: unknown[] = [wirePost()], page = 1, totalPages = 1) => ({
  data: posts,
  meta: { page, total_pages: totalPages },
});
const dataPage = (posts: unknown[] = [wirePost()], cursor: string | null = null) => ({
  data: posts,
  meta: {
    platforms: [
      { platform: 'Twitter', success: true, has_more: cursor !== null, next_cursor: cursor },
    ],
  },
});
const httpResponse = (
  data: string,
  {
    status = 200,
    headers = {},
  }: {
    status?: number;
    headers?: Record<string, string | undefined>;
  } = {},
): AxiosResponse<string> => {
  const responseHeaders = new AxiosHeaders();
  for (const [name, value] of Object.entries(headers)) {
    if (value !== undefined) {
      responseHeaders.set(name, value);
    }
  }
  return {
    data,
    status,
    statusText: '',
    headers: responseHeaders,
    config: { headers: new AxiosHeaders() },
  };
};
const json = (body: unknown) => httpResponse(JSON.stringify(body));
const adapterMock = () => vi.fn<AxiosAdapter>();
const calledUrl = (adapter: ReturnType<typeof adapterMock>, index: number) => {
  const { url } = adapter.mock.calls[index][0];
  if (url === undefined) {
    throw new Error('Expected a request URL');
  }
  return new URL(url);
};
const fixture = async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'huron-ingestion-'));
  roots.push(root);
  await mkdir(path.join(root, 'data/media/events'), { recursive: true });
  const file = path.join(root, 'data/media/events/2026-finals.json');
  await writeFile(file, `${JSON.stringify(record(), null, 2)}\n`);
  return { root, file };
};

describe('configuration and alt contract', () => {
  it('allows empty descriptions but requires a string', () => {
    const media = { type: 'image', url: 'https://example.com/a.png' };
    expect(postMediaSchema.parse({ ...media, alt: '' }).alt).toBe('');
    for (const alt of [undefined, null, 12]) {
      expect(postMediaSchema.safeParse({ ...media, alt }).success).toBe(false);
    }
  });

  it('allows empty bodies only with media and still requires a body string', () => {
    const post = normalizePost(candidate(), '2026-finals');
    for (const body of ['', '   ']) {
      expect(postSchema.safeParse({ ...post, body }).success).toBe(true);
      expect(postSchema.safeParse({ ...post, body, media: [] }).success).toBe(false);
    }
    for (const body of [undefined, null, 12]) {
      expect(postSchema.safeParse({ ...post, body }).success).toBe(false);
    }
    expect(postSchema.safeParse({ ...post, media: [] }).success).toBe(true);
  });

  it('parses both source modes and applies operational defaults', () => {
    const parsed = parseConfig(
      JSON.stringify(
        config([
          { type: 'feed', feedId: 123, platforms: ['x'] },
          { type: 'hashtag', platforms: ['instagram'] },
        ]),
      ),
    );
    expect(parsed.maxRequests).toBe(100);
    expect(parsed.events[0]?.sources).toHaveLength(2);
    expect(parseJson('[]', 'fixture')).toEqual([]);
    expect(() => parseConfig('{')).toThrow('invalid JSON');
  });

  it.each([
    { events: [{ eventId: '../mock', sources: [{ type: 'feed', feedId: 1 }] }] },
    { events: [{ eventId: 'event', sources: [] }] },
    { events: [{ eventId: 'event', sources: [{ type: 'hashtag', platforms: ['tiktok'] }] }] },
    { events: [{ eventId: 'event', sources: [{ type: 'hashtag', platforms: ['x', 'x'] }] }] },
    ...[[], ['ICPC'], ['#ICPC', '#icpc']].map((hashtags) => ({
      events: [{ eventId: 'event', sources: [{ type: 'hashtag', platforms: ['x'], hashtags }] }],
    })),
    {
      events: [{ eventId: 'event', sources: [{ type: 'feed', feedId: 1, hashtags: ['#ICPC'] }] }],
    },
    { ...config(), retries: 99 },
    { ...config(), typo: true },
    { ...config(), events: [eventConfig(), eventConfig()] },
    {
      events: [
        { ...eventConfig(), startingAt: '2026-10-23T00:00:00Z', endingAt: '2026-10-22T00:00:00Z' },
      ],
    },
  ])('rejects invalid configuration %#', (invalid) => {
    expect(() => parseConfig(JSON.stringify(invalid))).toThrow('Invalid ingestion configuration');
  });
});

describe('Juicer client', () => {
  it.each([
    {
      name: 'HTTP',
      response: () =>
        httpResponse(JSON.stringify({ error: { message: 'bad secret' } }), { status: 401 }),
      reason: 'HTTP 401',
    },
    {
      name: 'network',
      response: () => {
        throw new Error('secret');
      },
      reason: 'network request failed',
    },
    { name: 'JSON', response: () => httpResponse('{'), reason: 'invalid JSON' },
    {
      name: 'schema',
      response: () => json(feedPage([{ ...wirePost('bad'), message: 12 }], 2, 2)),
      reason: 'Invalid Juicer feed response',
    },
    {
      name: 'page number',
      response: () => json(feedPage([wirePost('bad')], 3, 3)),
      reason: 'feed page 3',
    },
    {
      name: 'post platform',
      response: () => json(feedPage([{ ...wirePost('bad'), platform: 'TikTok' }], 2, 2)),
      reason: 'unsupported platform',
    },
    {
      name: 'timestamp',
      response: () =>
        json(feedPage([{ ...wirePost('bad'), external_created_at: undefined }], 2, 2)),
      reason: 'publication timestamp',
    },
  ])(
    'retains validated pages after a $name failure and continues later sources',
    async ({ response, reason }) => {
      const cfg = { ...config(), retries: 0 };
      const adapter = adapterMock()
        .mockResolvedValueOnce(json(feedPage([wirePost('1')], 1, 2)))
        .mockImplementationOnce(() => Promise.resolve().then(response))
        .mockResolvedValueOnce(json(feedPage([wirePost('2')])));
      const warnings = vi.fn<(failure: IncompleteQuery) => void>();
      const client = new JuicerClient(cfg, 'secret', { adapter });
      const posts = await client.collect(
        eventConfig().sources[0],
        eventConfig(),
        '#ICPC',
        warnings,
      );
      expect(posts.map(({ externalId }) => externalId)).toEqual(['1']);
      expect(warnings.mock.calls[0][0]).toMatchObject({
        query: 'feed 123, all platforms',
        page: 2,
        retained: 1,
      });
      expect(warnings.mock.calls[0][0].reason).toContain(reason);
      expect(warnings.mock.calls[0][0].reason).not.toContain('secret');
      expect(
        await client.collect({ type: 'feed', feedId: 456 }, eventConfig(), '#ICPC', warnings),
      ).toHaveLength(1);
    },
  );

  it.each(['page', 'request'] as const)(
    'retains posts when the %s limit is reached',
    async (limit) => {
      const cfg = {
        ...config(),
        maxPages: limit === 'page' ? 1 : 2,
        maxRequests: limit === 'request' ? 1 : 3,
      };
      const adapter = adapterMock().mockResolvedValue(json(feedPage([wirePost()], 1, 2)));
      const warnings = vi.fn<(failure: IncompleteQuery) => void>();
      const posts = await new JuicerClient(cfg, 'secret', { adapter }).collect(
        eventConfig().sources[0],
        eventConfig(),
        '#ICPC',
        warnings,
      );
      expect(posts).toHaveLength(1);
      expect(warnings.mock.calls[0][0]).toMatchObject({
        retained: 1,
      });
      expect(warnings.mock.calls[0][0].reason).toContain(`${limit} limit`);
      expect(adapter).toHaveBeenCalledTimes(1);
    },
  );

  it('discards platform-failure data and continues later hashtag queries', async () => {
    const cfg = config([{ type: 'hashtag', platforms: ['x'], hashtags: ['#ICPC', '#GPM'] }]);
    const adapter = adapterMock()
      .mockResolvedValueOnce(json(dataPage([wirePost('1')], 'next')))
      .mockResolvedValueOnce(
        json({
          data: [wirePost('bad')],
          meta: { platforms: [{ platform: 'Twitter', success: false, message: 'timeout' }] },
        }),
      )
      .mockResolvedValueOnce(json(dataPage([wirePost('2')])));
    const warnings = vi.fn<(failure: IncompleteQuery) => void>();
    const posts = await new JuicerClient(cfg, 'secret', { adapter }).collect(
      cfg.events[0].sources[0],
      eventConfig(),
      '#ICPC',
      warnings,
    );
    expect(posts.map(({ externalId }) => externalId)).toEqual(['1', '2']);
    expect(warnings.mock.calls[0][0]).toMatchObject({ page: 2, retained: 1 });
    expect(calledUrl(adapter, 2).searchParams.get('cursor')).toBeNull();
  });

  it('does not exceed the shared request budget when subsequent queries are incomplete', async () => {
    const cfg = {
      ...config([{ type: 'hashtag', platforms: ['x'], hashtags: ['#ICPC', '#GPM'] }]),
      maxRequests: 1,
    };
    const adapter = adapterMock().mockResolvedValue(json(dataPage([wirePost()], 'next')));
    const warnings = vi.fn<(failure: IncompleteQuery) => void>();
    const posts = await new JuicerClient(cfg, 'secret', { adapter }).collect(
      cfg.events[0].sources[0],
      eventConfig(),
      '#ICPC',
      warnings,
    );
    expect(posts).toHaveLength(1);
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(warnings.mock.calls.map(([failure]) => failure.retained)).toEqual([1, 0]);
  });

  it('uses the configured budgets to complete a Facebook hashtag query beyond 20 pages', async () => {
    const cfg = parseConfig(
      await readFile(new URL('../../config/media-ingestion.json', import.meta.url), 'utf8'),
    );
    expect(cfg).toMatchObject({ maxPages: 100, maxRequests: 500 });
    const adapter = adapterMock();
    for (let page = 1; page <= 21; page += 1) {
      adapter.mockResolvedValueOnce(
        json({
          data: [{ ...wirePost(String(page)), platform: 'Facebook' }],
          meta: {
            platforms: [
              {
                platform: 'Facebook',
                success: true,
                has_more: page < 21,
                next_cursor: page < 21 ? `cursor-${String(page)}` : null,
              },
            ],
          },
        }),
      );
    }
    const posts = await new JuicerClient(cfg, 'secret', { adapter }).collect(
      { type: 'hashtag', platforms: ['facebook'], hashtags: ['#ICPCMexico'] },
      cfg.events[0],
      '#ICPCMexico',
    );
    expect(posts).toHaveLength(21);
    expect(adapter).toHaveBeenCalledTimes(21);
    expect(calledUrl(adapter, 20).searchParams.get('cursor')).toBe('cursor-20');
  });

  it('still rejects incomplete hashtag results and explains that date bounds do not limit pagination', async () => {
    const cfg = { ...config(), maxPages: 1 };
    const adapter = adapterMock().mockResolvedValue(json(dataPage([], 'more')));
    await expect(
      new JuicerClient(cfg, 'secret', { adapter }).collect(
        { type: 'hashtag', platforms: ['x'] },
        eventConfig(),
        '#ICPC',
      ),
    ).rejects.toThrow('date bounds filter locally and do not reduce hashtag pagination');
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it('shares a request budget across collections but isolates client instances', async () => {
    const adapter = adapterMock().mockImplementation(() => Promise.resolve(json(feedPage())));
    const clientConfig = { retries: 0, maxRequests: 2, maxPages: 1, requestTimeoutMs: 500 };
    const client = new JuicerClient(clientConfig, 'first-key', { adapter });
    const other = new JuicerClient(clientConfig, 'second-key', { adapter });
    const source = eventConfig().sources[0];

    await client.collect(source, eventConfig(), '#ICPC');
    await client.collect(source, eventConfig(), '#ICPC');
    await expect(client.collect(source, eventConfig(), '#ICPC')).rejects.toThrow('request limit');
    await other.collect(source, eventConfig(), '#ICPC');

    expect(adapter).toHaveBeenCalledTimes(3);
    expect(adapter.mock.calls[0][0].headers.get('Authorization')).toBe('Bearer first-key');
    expect(adapter.mock.calls[2][0].headers.get('Authorization')).toBe('Bearer second-key');
  });

  it('collects paginated public feed posts with filters and bounds', async () => {
    const adapter = adapterMock()
      .mockResolvedValueOnce(json(feedPage([wirePost('1')], 1, 2)))
      .mockResolvedValueOnce(json(feedPage([wirePost('2')], 2, 2)));
    const cfg = config([{ type: 'feed', feedId: 123, platforms: ['x'] }]);
    const event = {
      ...eventConfig(),
      startingAt: '2026-10-01T00:00:00Z',
      endingAt: '2026-11-01T00:00:00Z',
    };
    const posts = await new JuicerClient(cfg, 'secret', { adapter: adapter }).collect(
      cfg.events[0].sources[0],
      event,
      '#ICPC',
    );
    expect(posts).toHaveLength(2);
    expect(posts.every(({ searchedHashtag }) => searchedHashtag === '#ICPC')).toBe(true);
    const url = calledUrl(adapter, 1);
    expect(url.origin).toBe('https://api.juicer.io');
    expect(url.pathname).toBe('/v1/feeds/123/posts');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      page: '2',
      per_page: '100',
      filter: 'Twitter',
      status: 'public',
      starting_at: event.startingAt,
      ending_at: event.endingAt,
    });
    expect(adapter.mock.calls[0]?.[0]).toMatchObject({
      headers: { Authorization: 'Bearer secret' },
      maxRedirects: 0,
      timeout: cfg.requestTimeoutMs,
      responseType: 'text',
    });
  });

  it('collects per-platform hashtag cursors without a page size', async () => {
    const cfg = config([{ type: 'hashtag', platforms: ['x', 'instagram'] }]);
    const adapter = adapterMock()
      .mockResolvedValueOnce(json(dataPage([wirePost('1')], 'opaque-1')))
      .mockResolvedValueOnce(json(dataPage([wirePost('2')])))
      .mockResolvedValueOnce(
        json({
          data: [],
          meta: {
            platforms: [
              { platform: 'Instagram', success: true, has_more: false, next_cursor: null },
            ],
          },
        }),
      );
    const posts = await new JuicerClient(cfg, 'secret', { adapter: adapter }).collect(
      cfg.events[0].sources[0],
      eventConfig(),
      '#ICPC',
    );
    expect(posts).toHaveLength(2);
    const second = calledUrl(adapter, 1);
    expect(Object.fromEntries(second.searchParams)).toEqual({
      platforms: 'Twitter',
      term: '#ICPC',
      term_type: 'hashtag',
      cursor: 'opaque-1',
    });
    expect(calledUrl(adapter, 2).searchParams.get('cursor')).toBeNull();
  });

  it('continues Facebook hashtag pagination after a null message', async () => {
    const cfg = config([{ type: 'hashtag', platforms: ['facebook'] }]);
    const page = (posts: unknown[], cursor: string | null) => ({
      data: posts,
      meta: {
        platforms: [
          { platform: 'Facebook', success: true, has_more: cursor !== null, next_cursor: cursor },
        ],
      },
    });
    const adapter = adapterMock()
      .mockResolvedValueOnce(
        json(page([{ ...wirePost('1'), platform: 'Facebook', message: null }], 'next-page')),
      )
      .mockResolvedValueOnce(json(page([{ ...wirePost('2'), platform: 'Facebook' }], null)));
    const posts = await new JuicerClient(cfg, 'secret', { adapter }).collect(
      cfg.events[0].sources[0],
      eventConfig(),
      '#ICPCMexico',
    );
    expect(posts.map(({ post }) => post.message)).toEqual(['', wirePost().message]);
    expect(posts.map(({ externalId }) => externalId)).toEqual(['1', '2']);
    expect(calledUrl(adapter, 1).searchParams.get('cursor')).toBe('next-page');
  });

  it('queries each configured hashtag per platform instead of the event hashtag', async () => {
    const cfg = config([{ type: 'hashtag', platforms: ['x'], hashtags: ['#GPM2026', '#ICPC'] }]);
    const adapter = adapterMock()
      .mockResolvedValueOnce(json(dataPage([wirePost('1')])))
      .mockResolvedValueOnce(json(dataPage([wirePost('1')])));
    const posts = await new JuicerClient(cfg, 'secret', { adapter }).collect(
      cfg.events[0].sources[0],
      eventConfig(),
      '#EventHashtag',
    );
    expect(posts).toHaveLength(2);
    expect([0, 1].map((index) => calledUrl(adapter, index).searchParams.get('term'))).toEqual([
      '#GPM2026',
      '#ICPC',
    ]);
    expect(posts.map(({ searchedHashtag }) => searchedHashtag)).toEqual(['#GPM2026', '#ICPC']);
    const { summary } = appendPosts(record(), posts, cfg.events[0]);
    // The fixture text mentions #ICPC but not #GPM2026, so only the #ICPC result is kept.
    expect(summary).toMatchObject({ fetched: 2, added: 1, missingHashtag: 1, duplicates: 0 });
  });

  it('accepts empty feed pages and rejects invalid keys before requests', async () => {
    const cfg = config();
    const adapter = adapterMock().mockResolvedValue(json(feedPage([], 1, 0)));
    expect(
      await new JuicerClient(cfg, 'secret', { adapter: adapter }).collect(
        cfg.events[0].sources[0],
        eventConfig(),
        '#ICPC',
      ),
    ).toEqual([]);
    expect(() => new JuicerClient(cfg, '')).toThrow('JUICER_API_KEY');
    expect(() => new JuicerClient(cfg, 'bad\nkey')).toThrow('JUICER_API_KEY');
    for (const source of ['x', 'Instagram', 'facebook', 'YouTube', 'LinkedIn']) {
      expect(toPostSource(source)).toBe(source.toLowerCase());
    }
    expect(() => toPostSource('TikTok')).toThrow('unsupported platform');
  });

  it('filters individual feed sources by numeric ID', async () => {
    const cfg = config([{ type: 'feed', feedId: 123, sourceIds: [4, 5] }]);
    const adapter = adapterMock().mockResolvedValue(json(feedPage()));
    await new JuicerClient(cfg, 'secret', { adapter: adapter }).collect(
      cfg.events[0].sources[0],
      eventConfig(),
      '#ICPC',
    );
    expect(calledUrl(adapter, 0).searchParams.get('filter')).toBe('4,5');
    expect(
      configSchema.safeParse({
        events: [
          {
            ...eventConfig(),
            sources: [{ type: 'feed', feedId: 123, sourceIds: [4], platforms: ['x'] }],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it.each([
    { status: 429, headers: { 'retry-after': '2' }, delay: 2000 },
    { status: 503, headers: {}, delay: 1000 },
  ])('retries transient HTTP $status failures', async ({ status, headers, delay }) => {
    const cfg = config();
    const adapter = adapterMock()
      .mockResolvedValueOnce(httpResponse('', { status, headers }))
      .mockResolvedValueOnce(json(feedPage()));
    const sleep = vi.fn().mockResolvedValue(undefined);
    await new JuicerClient(cfg, 'secret', { adapter: adapter, sleep }).collect(
      cfg.events[0].sources[0],
      eventConfig(),
      '#ICPC',
    );
    expect(sleep).toHaveBeenCalledWith(delay);
  });

  it('retries network errors without echoing credential-bearing details', async () => {
    const cfg = config();
    const adapter = adapterMock()
      .mockRejectedValueOnce(new Error('secret'))
      .mockResolvedValueOnce(json(feedPage()));
    const sleep = vi.fn().mockResolvedValue(undefined);
    await new JuicerClient(cfg, 'secret', { adapter: adapter, sleep }).collect(
      cfg.events[0].sources[0],
      eventConfig(),
      '#ICPC',
    );
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it('honors HTTP-date Retry-After values', async () => {
    const cfg = config();
    const adapter = adapterMock()
      .mockResolvedValueOnce(
        httpResponse('', {
          status: 429,
          headers: { 'retry-after': new Date(Date.now() + 20_000).toUTCString() },
        }),
      )
      .mockResolvedValueOnce(json(feedPage()));
    const sleep = vi.fn().mockResolvedValue(undefined);
    await new JuicerClient(cfg, 'secret', { adapter: adapter, sleep }).collect(
      cfg.events[0].sources[0],
      eventConfig(),
      '#ICPC',
    );
    expect(sleep.mock.calls[0][0]).toBeGreaterThan(18_000);
    expect(sleep.mock.calls[0][0]).toBeLessThanOrEqual(20_000);
  });

  it.each([
    {
      response: () =>
        httpResponse('', { status: 302, headers: { location: 'https://example.com' } }),
      error: 'HTTP 302',
    },
    { response: () => httpResponse('secret', { status: 401 }), error: 'HTTP 401' },
    { response: () => httpResponse('secret', { status: 500 }), error: 'gave up after 1 attempt' },
    { response: () => httpResponse('{'), error: 'invalid JSON' },
    { response: () => json({ data: [], meta: {} }), error: 'Invalid Juicer feed response' },
    ...[null, '', '   '].map((message) => ({
      response: () => json(feedPage([{ ...wirePost(), message, media: [] }])),
      error: 'Invalid Juicer feed response',
    })),
    ...[undefined, 12].map((message) => ({
      response: () => json(feedPage([{ ...wirePost(), message }])),
      error: 'Invalid Juicer feed response',
    })),
    {
      response: () => json(feedPage([{ ...wirePost(), platform: 'TikTok' }])),
      error: 'unsupported platform',
    },
    {
      response: () => json(feedPage([{ ...wirePost(), external_created_at: undefined }])),
      error: 'publication timestamp',
    },
    { response: () => json(feedPage([], 2, 2)), error: 'feed page 2 when page 1 was requested' },
    { response: () => json(feedPage([], 1, 2)), error: 'page limit reached' },
  ])('rejects failed or incomplete feed responses %#', async ({ response, error }) => {
    const cfg = { ...config(), retries: 0, maxPages: 1 };
    const adapter = adapterMock().mockResolvedValue(response());
    await expect(
      new JuicerClient(cfg, 'secret', { adapter: adapter }).collect(
        cfg.events[0].sources[0],
        eventConfig(),
        '#ICPC',
      ),
    ).rejects.toThrow(error);
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it('explains Juicer error bodies with request context and hints', async () => {
    const cfg = config([{ type: 'hashtag', platforms: ['linkedin'], hashtags: ['#ICPCMX2026'] }]);
    const body = {
      error: {
        code: 'insufficient_credits',
        message: 'Your API credit balance is too low for this request.',
        action: { checkout_url: 'https://juicer.io/plans?source=insufficient_credits' },
      },
    };
    const adapter = adapterMock().mockResolvedValue(
      httpResponse(JSON.stringify(body), { status: 402 }),
    );
    const failure = new JuicerClient(cfg, 'secret', { adapter }).collect(
      cfg.events[0].sources[0],
      eventConfig(),
      '#ICPC',
    );
    await expect(failure).rejects.toThrow(
      '[event 2026-finals, hashtag #ICPCMX2026, platform linkedin, page 1] Juicer HTTP 402 insufficient_credits: Your API credit balance is too low for this request.',
    );
    await expect(failure).rejects.toThrow('remove hashtag sources');
    await expect(failure).rejects.toThrow('(https://juicer.io/plans?source=insufficient_credits)');
  });

  it('skips credit-exhausted queries only when the caller opts in', async () => {
    const cfg = config([
      { type: 'hashtag', platforms: ['x', 'linkedin'], hashtags: ['#ICPCMX2026', '#ICPCMexico'] },
    ]);
    const credits = httpResponse(JSON.stringify({ error: { code: 'insufficient_credits' } }), {
      status: 402,
    });
    const adapter = adapterMock().mockResolvedValue(credits);
    const client = new JuicerClient(cfg, 'secret', { adapter });
    const skipped: IncompleteQuery[] = [];
    const posts = await client.collect(cfg.events[0].sources[0], eventConfig(), '#ICPC', (skip) => {
      skipped.push(skip);
    });
    expect(posts).toEqual([]);
    // The first 402 is account-wide, so the remaining three queries make no request.
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(skipped.map(({ query }) => query)).toEqual([
      'hashtag #ICPCMX2026, platform x',
      'hashtag #ICPCMX2026, platform linkedin',
      'hashtag #ICPCMexico, platform x',
      'hashtag #ICPCMexico, platform linkedin',
    ]);
    expect(skipped[0]?.reason).toMatch(/^Juicer HTTP 402 insufficient_credits\. Hint: /);
    expect(skipped[3]?.reason).toContain('not requested');

    const feed = config();
    adapter.mockResolvedValue(json(feedPage()));
    expect(
      await client.collect(feed.events[0].sources[0], eventConfig(), '#ICPC', () => undefined),
    ).toHaveLength(1);

    adapter.mockResolvedValue(httpResponse('', { status: 401 }));
    const warnings = vi.fn<(failure: IncompleteQuery) => void>();
    expect(
      await new JuicerClient(cfg, 'secret', { adapter }).collect(
        cfg.events[0].sources[0],
        eventConfig(),
        '#ICPC',
        warnings,
      ),
    ).toEqual([]);
    expect(warnings.mock.calls[0][0]).toMatchObject({
      retained: 0,
    });
    expect(warnings.mock.calls[0][0].reason).toContain('HTTP 401');
  });

  it('never echoes non-JSON error bodies or the API key', async () => {
    const cfg = { ...config(), retries: 0 };
    const adapter = adapterMock().mockResolvedValue(
      httpResponse(JSON.stringify({ error: { message: 'bad key secret-key' } }), { status: 401 }),
    );
    const failure = new JuicerClient(cfg, 'secret-key', { adapter }).collect(
      cfg.events[0].sources[0],
      eventConfig(),
      '#ICPC',
    );
    await expect(failure).rejects.toThrow('bad key [REDACTED]');
    await expect(failure).rejects.toThrow('[event 2026-finals, feed 123, all platforms, page 1]');
    adapter.mockResolvedValue(httpResponse('<html>secret-key</html>', { status: 404 }));
    const notFound = new JuicerClient(cfg, 'secret-key', { adapter }).collect(
      cfg.events[0].sources[0],
      eventConfig(),
      '#ICPC',
    );
    await expect(notFound).rejects.toThrow(/HTTP 404\. Hint: .*numeric feed ID/);
    await expect(notFound).rejects.not.toThrow('html');
  });

  it('logs each attempt without credentials or cursors', async () => {
    const cfg = config([{ type: 'hashtag', platforms: ['x'] }]);
    const log = vi.fn<(line: string) => void>();
    const adapter = adapterMock()
      .mockResolvedValueOnce(json(dataPage([wirePost('1')], 'opaque-secret-cursor')))
      .mockResolvedValueOnce(json(dataPage([])));
    await new JuicerClient(cfg, 'secret', { adapter, log }).collect(
      cfg.events[0].sources[0],
      eventConfig(),
      '#ICPC',
    );
    const lines = log.mock.calls.map(([line]) => line);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(
      /^GET \/v1\/data\/posts\?platforms=Twitter&term=#ICPC&term_type=hashtag \(attempt 1\/3\) -> HTTP 200 in \d+ ms$/,
    );
    expect(lines[1]).toContain('cursor=…');
    expect(lines.join('\n')).not.toMatch(/secret/);
  });

  it('enforces request limits and bounded Retry-After', async () => {
    const cfg = { ...config(), maxRequests: 1 };
    const sleep = vi.fn().mockResolvedValue(undefined);
    const adapter = adapterMock().mockResolvedValue(httpResponse('', { status: 429 }));
    await expect(
      new JuicerClient(cfg, 'secret', { adapter: adapter, sleep }).collect(
        cfg.events[0].sources[0],
        eventConfig(),
        '#ICPC',
      ),
    ).rejects.toThrow('request limit');
    for (const retryAfter of ['9999', 'invalid']) {
      adapter.mockResolvedValue(
        httpResponse('', { status: 429, headers: { 'retry-after': retryAfter } }),
      );
      await expect(
        new JuicerClient(config(), 'secret', { adapter: adapter, sleep }).collect(
          cfg.events[0].sources[0],
          eventConfig(),
          '#ICPC',
        ),
      ).rejects.toThrow('Retry-After');
    }
    adapter.mockRejectedValue(new Error('secret'));
    await expect(
      new JuicerClient({ ...config(), retries: 0 }, 'secret', { adapter: adapter }).collect(
        cfg.events[0].sources[0],
        eventConfig(),
        '#ICPC',
      ),
    ).rejects.toThrow('network request failed');
  });

  it.each([
    { platforms: [], error: 'expected exactly one' },
    { platforms: [{ platform: 'Twitter', success: false }], error: 'Twitter platform failure' },
    {
      platforms: [
        {
          platform: 'Twitter',
          success: false,
          error_code: 'fetch_timeout',
          message: 'Twitter request timed out.',
        },
      ],
      error: '(fetch_timeout: Twitter request timed out.)',
    },
    {
      platforms: [{ platform: 'Instagram', success: true, has_more: false, next_cursor: null }],
      error: 'instead of the requested platform',
    },
    { platforms: [{ platform: 'Twitter', success: true }], error: 'pagination status' },
    {
      platforms: [{ platform: 'Twitter', success: true, has_more: true, next_cursor: null }],
      error: 'inconsistent pagination',
    },
  ])(
    'rejects HTTP-200 platform failures and incomplete status %#',
    async ({ platforms, error }) => {
      const cfg = config([{ type: 'hashtag', platforms: ['x'] }]);
      const adapter = adapterMock().mockResolvedValue(json({ data: [], meta: { platforms } }));
      await expect(
        new JuicerClient(cfg, 'secret', { adapter: adapter }).collect(
          cfg.events[0].sources[0],
          eventConfig(),
          '#ICPC',
        ),
      ).rejects.toThrow(error);
    },
  );

  it('rejects repeated cursors and posts outside platform filters', async () => {
    const cfg = config([{ type: 'hashtag', platforms: ['x'] }]);
    const adapter = adapterMock().mockImplementation(() =>
      Promise.resolve(json(dataPage([], 'same'))),
    );
    await expect(
      new JuicerClient(cfg, 'secret', { adapter: adapter }).collect(
        cfg.events[0].sources[0],
        eventConfig(),
        '#ICPC',
      ),
    ).rejects.toThrow('repeated');
    adapter.mockResolvedValue(json(dataPage([{ ...wirePost(), platform: 'Instagram' }])));
    await expect(
      new JuicerClient(cfg, 'secret', { adapter: adapter }).collect(
        cfg.events[0].sources[0],
        eventConfig(),
        '#ICPC',
      ),
    ).rejects.toThrow('outside the requested platform');
  });
});

describe('normalization and append-only merging', () => {
  it('maps fields, preserves real alt text, omits links, and scopes stable IDs by event', () => {
    const post = normalizePost(candidate(), '2026-finals');
    expect(post.author).toEqual({
      username: 'club',
      displayName: 'Club',
      profileUrl: 'https://x.com/club',
      avatarUrl: 'https://example.com/avatar.png',
    });
    expect(post.tags).toEqual(['#ICPC', '#México']);
    expect(post.media).toHaveLength(2);
    expect(post.media.map(({ alt }) => alt)).toEqual(['', 'Teams celebrating']);
    expect(post.id).not.toBe(normalizePost(candidate(), 'other-event').id);
    expect(post.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    const item = candidate();
    item.externalId = undefined;
    expect(normalizePost(item, '2026-finals').id).toBe(normalizePost(item, '2026-finals').id);
    item.post.poster = { name: 'club' };
    expect(normalizePost(item, '2026-finals').author).toEqual({ username: 'club' });
  });

  it('canonicalizes attribution links without losing meaningful query parameters', () => {
    expect(
      canonicalPermalink('https://www.twitter.com/club/status/1/?s=20&utm_source=test#top'),
    ).toBe('https://x.com/club/status/1');
    expect(canonicalPermalink('https://www.youtube.com/watch?v=abc&t=5')).toBe(
      'https://youtube.com/watch?v=abc',
    );
    expect(() => canonicalPermalink('javascript:alert(1)')).toThrow('HTTP or HTTPS');
  });

  it('preserves curated content, deduplicates both modes, sorts only additions', () => {
    const existing = record();
    const curated = {
      ...normalizePost(candidate(), '2026-finals'),
      id: 'curated',
      body: 'Corrected by reviewer',
    };
    curated.media[0].alt = 'Contributor description';
    existing.posts.push(curated);
    existing.event.postIds.push(curated.id);
    const result = appendPosts(
      existing,
      [candidate('2'), candidate('1'), candidate('2'), candidate('3')],
      eventConfig(),
    );
    expect(result.record.posts[0]).toEqual(curated);
    expect(result.record.event.postIds[0]).toBe('curated');
    expect(result.summary).toMatchObject({ fetched: 4, added: 2, duplicates: 2, missingAlt: 2 });
    expect(appendPosts(result.record, [candidate('2')], eventConfig()).record).toEqual(
      result.record,
    );
  });

  it('reports suppressed and out-of-window posts', () => {
    const result = appendPosts(record(), [candidate(), candidate('2')], {
      ...eventConfig(),
      suppressedPermalinks: [candidate().post.url],
    });
    expect(result.summary.suppressed).toBe(1);
    expect(result.summary.added).toBe(1);
    expect(
      appendPosts(record(), [candidate()], { ...eventConfig(), startingAt: '2026-10-23T00:00:00Z' })
        .summary.outsideDateRange,
    ).toBe(1);
    expect(
      appendPosts(record(), [candidate()], { ...eventConfig(), endingAt: '2026-10-21T00:00:00Z' })
        .summary.outsideDateRange,
    ).toBe(1);
  });

  it('drops posts whose text does not contain the searched hashtag', () => {
    const unrelated = candidate('2');
    unrelated.post = { ...unrelated.post, message: 'Motocross #ICPCMX #mx' };
    const mixedCase = candidate('3');
    mixedCase.post = { ...mixedCase.post, message: 'Gran final #icpc' };
    const result = appendPosts(record(), [candidate(), unrelated, mixedCase], eventConfig());
    expect(result.summary).toMatchObject({ fetched: 3, added: 2, missingHashtag: 1 });
    expect(result.record.posts.map(({ body }) => body)).not.toContain('Motocross #ICPCMX #mx');
    expect(containsHashtag('Final #ICPCMX2026!', '#icpcmx2026')).toBe(true);
    expect(containsHashtag('Final #ICPCMX20261', '#ICPCMX2026')).toBe(false);
    expect(containsHashtag('Final ICPCMX2026', '#ICPCMX2026')).toBe(false);
  });
});

describe('filesystem ingestion', () => {
  it.each(
    (
      [
        { type: 'feed', feedId: 123 },
        { type: 'hashtag', platforms: ['facebook'] },
      ] satisfies SourceConfig[]
    ).flatMap((source) => [null, '', '   '].map((message) => ({ source, message }))),
  )(
    'rejects captionless media through $source.type with message $message because it lacks the hashtag',
    async ({ source, message }) => {
      const { root, file } = await fixture();
      const before = await readFile(file, 'utf8');
      const cfg = config([source]);
      const post = { ...wirePost(), platform: 'Facebook', message };
      const page =
        source.type === 'feed'
          ? feedPage([post])
          : {
              ...dataPage([post]),
              meta: {
                platforms: [
                  { platform: 'Facebook', success: true, has_more: false, next_cursor: null },
                ],
              },
            };
      const adapter = adapterMock().mockResolvedValue(json(page));
      expect(
        await ingestMedia({ root, config: cfg, apiKey: 'secret', dependencies: { adapter } }),
      ).toMatchObject([{ fetched: 1, added: 0, missingHashtag: 1, incomplete: [] }]);
      expect(await readFile(file, 'utf8')).toBe(before);
    },
  );

  it('warns about captionless link-only hashtag posts without writing files', async () => {
    const { root, file } = await fixture();
    const before = await readFile(file, 'utf8');
    const adapter = adapterMock().mockResolvedValue(
      json(
        dataPage([
          {
            ...wirePost(),
            message: null,
            media: [{ type: 'link', url: 'https://example.com/article' }],
          },
        ]),
      ),
    );
    const warnings = vi.fn<(warning: string) => void>();
    expect(
      await ingestMedia({
        root,
        config: config([{ type: 'hashtag', platforms: ['x'] }]),
        apiKey: 'secret',
        dependencies: { adapter },
        onWarning: warnings,
      }),
    ).toMatchObject([{ added: 0, incomplete: [{ retained: 0, page: 1 }] }]);
    expect(warnings.mock.calls[0][0]).toContain('must contain text or image/video media');
    expect(await readFile(file, 'utf8')).toBe(before);
  });

  it('publishes partial validated results, reports them, and remains dry-run safe and idempotent', async () => {
    const { root, file } = await fixture();
    const cfg = { ...config(), maxPages: 1 };
    const adapter = adapterMock().mockResolvedValue(json(feedPage([wirePost()], 1, 2)));
    const warnings = vi.fn<(warning: string) => void>();
    const before = await readFile(file, 'utf8');
    const options = {
      root,
      config: cfg,
      apiKey: 'secret',
      dependencies: { adapter },
      onWarning: warnings,
    };
    expect(await ingestMedia({ ...options, dryRun: true })).toMatchObject([
      { added: 1, skipped: [], incomplete: [{ retained: 1, page: 1 }] },
    ]);
    expect(await readFile(file, 'utf8')).toBe(before);
    expect(await ingestMedia(options)).toMatchObject([{ added: 1, incomplete: [{ retained: 1 }] }]);
    const written = await readFile(file, 'utf8');
    expect(JSON.parse(written)).toMatchObject({ posts: [{ body: wirePost().message }] });
    expect(await ingestMedia(options)).toMatchObject([
      { added: 0, duplicates: 1, incomplete: [{ retained: 1 }] },
    ]);
    expect(await readFile(file, 'utf8')).toBe(written);
    expect(warnings.mock.calls[0][0]).toContain('Partial: retained 1 posts');
  });

  it('combines adapters, writes valid JSON, and is byte-idempotent on a second run', async () => {
    const { root, file } = await fixture();
    const cfg = config([
      { type: 'feed', feedId: 123 },
      { type: 'hashtag', platforms: ['x'] },
    ]);
    const adapter = adapterMock()
      .mockResolvedValueOnce(json(feedPage()))
      .mockResolvedValueOnce(json(dataPage()));
    expect(
      await ingestMedia({
        root,
        config: cfg,
        apiKey: 'secret',
        dependencies: { adapter: adapter },
      }),
    ).toMatchObject([{ added: 1, duplicates: 1 }]);
    const contents = await readFile(file, 'utf8');
    adapter.mockResolvedValueOnce(json(feedPage())).mockResolvedValueOnce(json(dataPage()));
    expect(
      await ingestMedia({
        root,
        config: cfg,
        apiKey: 'secret',
        dependencies: { adapter: adapter },
      }),
    ).toMatchObject([{ added: 0, duplicates: 2 }]);
    expect(await readFile(file, 'utf8')).toBe(contents);
    expect(await readdir(path.dirname(file))).toEqual(['2026-finals.json']);
  });

  it('dry-runs without modifying the archive or mock dataset', async () => {
    const { root, file } = await fixture();
    await mkdir(path.join(root, 'data/mock/media/events'), { recursive: true });
    const mockFile = path.join(root, 'data/mock/media/events/2026-finals.json');
    await writeFile(mockFile, 'mock sentinel');
    const before = await readFile(file, 'utf8');
    const adapter = adapterMock().mockResolvedValue(json(feedPage()));
    const result = await ingestMedia({
      root,
      config: config(),
      apiKey: 'secret',
      dryRun: true,
      dependencies: { adapter: adapter },
    });
    expect(result[0]?.added).toBe(1);
    expect(await readFile(file, 'utf8')).toBe(before);
    expect(await readFile(mockFile, 'utf8')).toBe('mock sentinel');
  });

  it('records skipped credit-limited sources and keeps other sources', async () => {
    const { root, file } = await fixture();
    const cfg = config([
      { type: 'feed', feedId: 123 },
      { type: 'hashtag', platforms: ['x'] },
    ]);
    const adapter = adapterMock()
      .mockResolvedValueOnce(json(feedPage()))
      .mockResolvedValueOnce(
        httpResponse(JSON.stringify({ error: { code: 'insufficient_credits' } }), { status: 402 }),
      );
    const warnings: string[] = [];
    const [summary] = await ingestMedia({
      root,
      config: cfg,
      apiKey: 'secret',
      dependencies: { adapter },
      onWarning: (warning) => {
        warnings.push(warning);
      },
    });
    expect(summary.added).toBe(1);
    expect(summary.skipped).toEqual(['hashtag #ICPC, platform x']);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(
      /^\[event 2026-finals, hashtag #ICPC, platform x\] Skipped: Juicer HTTP 402 insufficient_credits/,
    );
    expect(await readFile(file, 'utf8')).toMatch(/"postIds": \[\s*"2026-finals-x-/);
  });

  it('writes successful events even if a later event query fails', async () => {
    const { root, file } = await fixture();
    const secondFile = path.join(root, 'data/media/events/other-event.json');
    const second = record();
    second.event.id = 'other-event';
    await writeFile(secondFile, JSON.stringify(second));
    const cfg = configSchema.parse({
      events: [eventConfig(), { ...eventConfig(), eventId: 'other-event' }],
      retries: 0,
    });
    const adapter = adapterMock()
      .mockResolvedValueOnce(json(feedPage()))
      .mockResolvedValueOnce(httpResponse('', { status: 401 }));
    const before = await readFile(secondFile, 'utf8');
    const warnings = vi.fn<(warning: string) => void>();
    expect(
      await ingestMedia({
        root,
        config: cfg,
        apiKey: 'secret',
        dependencies: { adapter },
        onWarning: warnings,
      }),
    ).toMatchObject([
      { eventId: '2026-finals', added: 1, incomplete: [] },
      { eventId: 'other-event', added: 0, incomplete: [{ retained: 0, page: 1 }] },
    ]);
    expect(warnings.mock.calls[0][0]).toContain('HTTP 401');
    expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({
      posts: [{ body: wirePost().message }],
    });
    expect(await readFile(secondFile, 'utf8')).toBe(before);
  });

  it('rejects empty configuration, missing targets, invalid records, and unresolved references', async () => {
    const { root, file } = await fixture();
    const adapter = adapterMock();
    await expect(
      ingestMedia({ root, config: configSchema.parse({ events: [] }), apiKey: '' }),
    ).rejects.toThrow('No events configured');
    await expect(
      ingestMedia({ root, config: config([{ type: 'feed', feedId: 1 }]), apiKey: '' }),
    ).rejects.toThrow('JUICER_API_KEY');
    await expect(
      ingestMedia({
        root,
        config: configSchema.parse({ events: [{ ...eventConfig(), eventId: 'missing' }] }),
        apiKey: 'secret',
        dependencies: { adapter: adapter },
      }),
    ).rejects.toThrow('ENOENT');
    const invalid = record();
    invalid.event.id = 'different';
    await writeFile(file, JSON.stringify(invalid));
    await expect(
      ingestMedia({ root, config: config(), apiKey: 'secret', dependencies: { adapter: adapter } }),
    ).rejects.toThrow('mismatched event ID');
    await writeFile(
      file,
      JSON.stringify({ ...record(), event: { ...record().event, contestId: 'missing' } }),
    );
    await expect(
      ingestMedia({ root, config: config(), apiKey: 'secret', dependencies: { adapter: adapter } }),
    ).rejects.toThrow('unknown contest');
    expect(adapter).not.toHaveBeenCalled();
  });

  it('rejects symlinked targets before requests', async () => {
    const { root, file } = await fixture();
    const original = path.join(root, 'original.json');
    await writeFile(original, await readFile(file));
    await rm(file);
    await symlink(original, file);
    await expect(ingestMedia({ root, config: config(), apiKey: 'secret' })).rejects.toThrow(
      'symlink',
    );
  });

  it('detects a concurrent edit instead of overwriting it', async () => {
    const { root, file } = await fixture();
    const adapter = adapterMock().mockImplementation(async () => {
      await writeFile(file, `${JSON.stringify(record())}\n`);
      return json(feedPage());
    });
    await expect(
      ingestMedia({ root, config: config(), apiKey: 'secret', dependencies: { adapter: adapter } }),
    ).rejects.toThrow('changed during ingestion');
    expect(await readdir(path.dirname(file))).toEqual(['2026-finals.json']);
  });

  it('preserves contributor metadata at every archive level when adding posts', async () => {
    const { root, file } = await fixture();
    const curated = normalizePost(candidate('curated'), '2026-finals');
    await writeFile(
      file,
      JSON.stringify({
        ...record(),
        notes: 'Top-level curation',
        event: { ...record().event, postIds: [curated.id], notes: 'Event curation' },
        posts: [
          {
            ...curated,
            title: 'Manual title',
            notes: 'Post curation',
            author: { ...curated.author, notes: 'Author curation' },
            media: [{ ...curated.media[0], alt: 'Manual description', notes: 'Media curation' }],
          },
        ],
      }),
    );
    await ingestMedia({
      root,
      config: config(),
      apiKey: 'secret',
      dependencies: { adapter: adapterMock().mockResolvedValue(json(feedPage())) },
    });
    expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({
      notes: 'Top-level curation',
      event: { notes: 'Event curation' },
      posts: [
        {
          title: 'Manual title',
          notes: 'Post curation',
          author: { notes: 'Author curation' },
          media: [{ alt: 'Manual description', notes: 'Media curation' }],
        },
        { id: normalizePost(candidate(), '2026-finals').id },
      ],
    });
  });

  it('validates proposed posts against other files before writing', async () => {
    const { root, file } = await fixture();
    const conflicting = normalizePost(candidate(), '2026-finals');
    const other = {
      event: { ...record().event, id: 'other-event', postIds: [conflicting.id] },
      posts: [conflicting],
    };
    await writeFile(path.join(root, 'data/media/events/other-event.json'), JSON.stringify(other));
    const before = await readFile(file, 'utf8');
    await expect(
      ingestMedia({
        root,
        config: config(),
        apiKey: 'secret',
        dependencies: { adapter: adapterMock().mockResolvedValue(json(feedPage())) },
      }),
    ).rejects.toThrow('duplicate post id');
    expect(await readFile(file, 'utf8')).toBe(before);
  });
});
