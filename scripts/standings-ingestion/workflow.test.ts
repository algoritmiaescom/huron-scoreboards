// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { expect, it } from 'vitest';

const workflow = await readFile(
  new URL('../../.github/workflows/ingest-standings.yml', import.meta.url),
  'utf8',
);

it('makes installed uv available to both same-step sync commands and later workflow steps', async () => {
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

it.each([
  { status: 'complete', exitCode: '0', saved: true, failed: false },
  { status: 'failed', exitCode: '1', saved: true, failed: true },
  { status: '', exitCode: '1', saved: false, failed: true },
])(
  'only enables draft generation and publication when acquisition saves a proposal ($status, $saved)',
  async ({ status, exitCode, saved, failed }) => {
    const commands = / {10}set -euo pipefail\n {10}paths_file=[\s\S]*?(?= {6}- name:)/.exec(
      workflow,
    )?.[0];
    if (commands === undefined) {
      throw new Error('Could not find the acquisition commands in the workflow');
    }
    const root = await mkdtemp(path.join(tmpdir(), 'standings-acquisition-workflow-'));
    try {
      const bin = path.join(root, 'bin');
      const githubOutput = path.join(root, 'github-output');
      await mkdir(bin);
      await writeFile(
        path.join(bin, 'npm'),
        [
          '#!/bin/sh',
          'if [ "$TEST_SAVED" = true ]; then',
          '  printf "Review proposal written: proposal.json\\n"',
          '  printf "Run status: %s; archive unchanged.\\n" "$TEST_STATUS"',
          'else',
          '  printf "%s\\n" "--season-from and --season-to must be valid ascending season years." >&2',
          'fi',
          'exit "$TEST_EXIT"',
          '',
        ].join('\n'),
        { mode: 0o755 },
      );
      const output = execFileSync('/bin/bash', ['--noprofile', '--norc', '-euc', commands], {
        env: {
          PATH: `${bin}:${process.env.PATH ?? '/usr/bin:/bin'}`,
          RUNNER_TEMP: root,
          GITHUB_OUTPUT: githubOutput,
          SOURCE: 'icpc-mexico',
          SEASON: '',
          SEASON_FROM: '2021',
          SEASON_TO: saved ? '2025' : '205',
          EVENT_NAME: 'workflow_dispatch',
          TEST_SAVED: String(saved),
          TEST_STATUS: status,
          TEST_EXIT: exitCode,
        },
        encoding: 'utf8',
        stdio: 'pipe',
      });
      const outputs = await readFile(githubOutput, 'utf8');
      const pathsFile = path.join(root, 'standings-proposal-paths.txt');
      expect(outputs).toBe(
        `${saved ? `proposal_paths_file=${pathsFile}\n` : ''}source_failures=${String(failed)}\n`,
      );
      expect(await readFile(pathsFile, 'utf8')).toBe(saved ? 'proposal.json\n' : '');
      expect(output.includes('::error::Acquisition produced no saved proposals.')).toBe(!saved);
      expect(await readFile(path.join(root, 'standings-ingestion-0.log'), 'utf8')).toContain(
        saved ? `Run status: ${status}` : 'must be valid ascending season years',
      );
      expect(workflow.split("steps.collect.outputs.proposal_paths_file != ''").length - 1).toBe(2);
      expect(workflow).toContain('${{ runner.temp }}/standings-ingestion-*.log');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
