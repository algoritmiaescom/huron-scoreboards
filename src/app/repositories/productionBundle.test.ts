// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';
import { afterEach, expect, it, vi } from 'vitest';

import { createApplicationRepositories, loadApplicationData } from './applicationData';
import { scoreboardsCatalogPlugin } from '../../../vite.scoreboardsCatalog.mjs';

const archiveFiles = import.meta.glob<string>(['/data/**/*.json', '!/data/mock/**/*.json'], {
  query: '?raw',
  import: 'default',
});

afterEach(() => {
  vi.unstubAllEnvs();
});

it.each(['mock', 'archive', 'invalid'])(
  'excludes mock chunks and uses only the real archive in production with VITE_DATA_SOURCE=%s',
  async (source) => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VITE_DATA_SOURCE', source);
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      resolve: { alias: { '@': fileURLToPath(new URL('../../', import.meta.url)) } },
      plugins: [scoreboardsCatalogPlugin()],
      build: {
        write: false,
        lib: {
          entry: fileURLToPath(new URL('./applicationData.ts', import.meta.url)),
          name: 'ArchiveRuntime',
          formats: ['iife'],
        },
      },
    });
    if (!Array.isArray(result)) {
      throw new Error('Expected library build outputs');
    }
    const output = result.flatMap((bundle) => bundle.output);
    expect(output).toHaveLength(1);
    const entry = output[0];
    if (entry.type !== 'chunk') {
      throw new Error('Expected an executable entry chunk');
    }
    expect(
      Object.keys(entry.modules).some(
        (id) => id.includes('/data/mock/') || id.includes('/mockDataFiles'),
      ),
    ).toBe(false);
    const stdout = execFileSync(process.execPath, ['--input-type=commonjs'], {
      input: `${entry.code}
ArchiveRuntime.loadApplicationRepositories().then(async (repositories) => {
  const result = await ArchiveRuntime.loadApplicationData(repositories);
  console.log(JSON.stringify({
    source: repositories.source,
    scoreboards: result.scoreboards.status,
    media: result.media.status
  }));
}).catch((error) => { console.error(error); process.exitCode = 1; });`,
      encoding: 'utf8',
    });
    const expected = await loadApplicationData(
      createApplicationRepositories(archiveFiles, 'archive'),
    );
    expect(stdout.trim()).toBe(
      JSON.stringify({
        source: 'archive',
        scoreboards: expected.scoreboards.status,
        media: expected.media.status,
      }),
    );
  },
);
