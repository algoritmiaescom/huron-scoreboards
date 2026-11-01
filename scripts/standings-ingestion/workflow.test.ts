// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

it('makes installed uv available to both same-step sync commands and later workflow steps', async () => {
  const workflow = await readFile(
    new URL('../../.github/workflows/ingest-standings.yml', import.meta.url),
    'utf8',
  );
  const commands =
    / {10}echo "\$RUNNER_TEMP\/uv-x86_64-unknown-linux-gnu"[\s\S]*?(?= {10}npx playwright)/.exec(
      workflow,
    )?.[0];
  expect(commands).toBeDefined();
  if (commands === undefined) {
    throw new Error('Could not find the uv PATH setup and sync commands in the workflow');
  }

  const root = await mkdtemp(path.join(tmpdir(), 'standings-workflow-'));
  try {
    const bin = path.join(root, 'uv-x86_64-unknown-linux-gnu');
    const githubPath = path.join(root, 'github-path');
    await mkdir(bin);
    await writeFile(path.join(bin, 'uv'), '#!/bin/sh\nprintf "%s\\n" "$*"\n', {
      mode: 0o755,
    });
    const output = execFileSync('/bin/bash', ['--noprofile', '--norc', '-euc', commands], {
      env: { PATH: '/nonexistent', RUNNER_TEMP: root, GITHUB_PATH: githubPath },
      encoding: 'utf8',
    });
    expect(output.split('\n').filter(Boolean)).toEqual([
      'sync --locked --project scripts/standings-spike',
      'sync --locked --project scripts/standings-ingestion',
    ]);
    expect(await readFile(githubPath, 'utf8')).toBe(`${bin}\n`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
