import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import { defineConfig, mergeConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

import baseConfig from './vite.config.ts';

const publicDir = fileURLToPath(new URL('./public', import.meta.url));

const MIME_TYPES: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const listFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });

const toDataUri = (file: string): string =>
  `data:${MIME_TYPES[path.extname(file)] ?? 'application/octet-stream'};base64,${readFileSync(file).toString('base64')}`;

const inlinedPublicFiles = Object.fromEntries(
  listFiles(publicDir).map((file) => [
    path.relative(publicDir, file).split(path.sep).join('/'),
    toDataUri(file),
  ]),
);

const MAX_REMOTE_BYTES = 10_000_000;
const REMOTE_TIMEOUT_MS = 20_000;
const CONCURRENCY = 16;
// Widths are roughly twice the rendered size; vector, icon and animated formats are kept as-is.
const LOGO_WIDTH = 160;
const AVATAR_WIDTH = 96;
const POST_IMAGE_WIDTH = 960;
const KEPT_AS_IS = new Set([
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/gif',
]);

interface RemoteImage {
  url: string;
  width: number;
}

// An image that cannot be fetched is skipped and falls back to its placeholder at runtime.
const fetchRemoteImage = async ({
  url,
  width,
}: RemoteImage): Promise<[string, string] | undefined> => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(REMOTE_TIMEOUT_MS) });
    const type = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    const body = Buffer.from(await response.arrayBuffer());
    if (!response.ok || !type.startsWith('image/') || body.length > MAX_REMOTE_BYTES) {
      throw new Error(`HTTP ${String(response.status)}, ${type}, ${String(body.length)} bytes`);
    }
    if (KEPT_AS_IS.has(type)) {
      return [url, `data:${type};base64,${body.toString('base64')}`];
    }
    const resized = await sharp(body)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();
    return [url, `data:image/webp;base64,${resized.toString('base64')}`];
  } catch (error) {
    console.warn(`[offline] image skipped: ${url} (${String(error)})`);
    return undefined;
  }
};

const dataDir = fileURLToPath(new URL('./data', import.meta.url));

interface MediaEventFile {
  posts: { author: { avatarUrl?: string }; media: { type: string; url: string }[] }[];
}

const remoteImageSources = (): RemoteImage[] => {
  const schools = readFileSync(path.join(dataDir, 'schools.json'), 'utf8');
  const logos = [...schools.matchAll(/"logo": "(https:\/\/[^"]+)"/g)].map((match) => ({
    url: match[1],
    width: LOGO_WIDTH,
  }));
  const eventsDir = path.join(dataDir, 'media', 'events');
  const media = readdirSync(eventsDir).flatMap((file) => {
    const { posts } = JSON.parse(
      readFileSync(path.join(eventsDir, file), 'utf8'),
    ) as MediaEventFile;
    return posts.flatMap((post) => [
      ...(post.author.avatarUrl === undefined
        ? []
        : [{ url: post.author.avatarUrl, width: AVATAR_WIDTH }]),
      ...post.media
        .filter(({ type }) => type === 'image')
        .map(({ url }) => ({ url, width: POST_IMAGE_WIDTH })),
    ]);
  });
  return [...new Map([...logos, ...media].map((source) => [source.url, source])).values()];
};

const downloadAll = async (sources: RemoteImage[]): Promise<Record<string, string>> => {
  const entries: ([string, string] | undefined)[] = [];
  for (let start = 0; start < sources.length; start += CONCURRENCY) {
    entries.push(
      ...(await Promise.all(sources.slice(start, start + CONCURRENCY).map(fetchRemoteImage))),
    );
  }
  return Object.fromEntries(entries.filter((entry) => entry !== undefined));
};

const remoteImages = await downloadAll(remoteImageSources());

// Public files are looked up by URL at runtime, so the bundler cannot inline them itself.
const inlineFavicon = (): Plugin => ({
  name: 'inline-favicon',
  transformIndexHtml: (html) =>
    html.replace('href="/favicon.svg"', `href="${inlinedPublicFiles['favicon.svg'] ?? ''}"`),
});

export default mergeConfig(
  baseConfig,
  defineConfig({
    base: './',
    define: {
      __INLINE_PUBLIC_ASSETS__: JSON.stringify({ ...inlinedPublicFiles, ...remoteImages }),
    },
    plugins: [viteSingleFile(), inlineFavicon()],
    build: {
      outDir: 'dist-offline',
      assetsInlineLimit: Number.MAX_SAFE_INTEGER,
      copyPublicDir: false,
    },
  }),
);
