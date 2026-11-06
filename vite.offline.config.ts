import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const MAX_REMOTE_BYTES = 1_000_000;
const REMOTE_TIMEOUT_MS = 20_000;

// A logo that cannot be fetched is skipped and falls back to the generic icon at runtime.
const fetchRemoteLogo = async (url: string): Promise<[string, string] | undefined> => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(REMOTE_TIMEOUT_MS) });
    const type = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    const body = Buffer.from(await response.arrayBuffer());
    if (!response.ok || !type.startsWith('image/') || body.length > MAX_REMOTE_BYTES) {
      throw new Error(`HTTP ${String(response.status)}, ${type}, ${String(body.length)} bytes`);
    }
    return [url, `data:${type};base64,${body.toString('base64')}`];
  } catch (error) {
    console.warn(`[offline] logo skipped: ${url} (${String(error)})`);
    return undefined;
  }
};

const remoteLogoUrls = (): string[] => {
  const schools = readFileSync(
    path.join(fileURLToPath(new URL('./data', import.meta.url)), 'schools.json'),
    'utf8',
  );
  return [
    ...new Set([...schools.matchAll(/"logo": "(https:\/\/[^"]+)"/g)].map((match) => match[1])),
  ];
};

const remoteLogos = Object.fromEntries(
  (await Promise.all(remoteLogoUrls().map(fetchRemoteLogo))).filter((entry) => entry !== undefined),
);

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
    define: { __INLINE_PUBLIC_ASSETS__: JSON.stringify({ ...inlinedPublicFiles, ...remoteLogos }) },
    plugins: [viteSingleFile(), inlineFavicon()],
    build: {
      outDir: 'dist-offline',
      assetsInlineLimit: Number.MAX_SAFE_INTEGER,
      copyPublicDir: false,
    },
  }),
);
