// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map(async (root) => rm(root, { recursive: true, force: true })),
  );
});

const workflow = await readFile(
  new URL('../../.github/workflows/ingest-media.yml', import.meta.url),
  'utf8',
);
const ciWorkflow = await readFile(
  new URL('../../.github/workflows/ci.yml', import.meta.url),
  'utf8',
);
const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const tsx = path.join(repositoryRoot, 'node_modules/.bin/tsx');
const cli = path.join(repositoryRoot, 'scripts/media-pull-request.ts');
const prepare = 'prepare';
const publish = 'publish';
const branch = 'automation/media-ingestion';
const target = 'data/media/events/2026-finals.json';

const setup = async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'huron-workflow-'));
  roots.push(root);
  const remote = path.join(root, 'remote.git');
  const repo = path.join(root, 'repo');
  const bin = path.join(root, 'bin');
  const output = path.join(root, 'output');
  const log = path.join(root, 'gh.log');
  await mkdir(repo);
  await mkdir(bin);
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: 'pipe' }).trim();
  execFileSync('git', ['init', '--bare', remote], { stdio: 'pipe' });
  git('init', '-b', 'main');
  git('config', 'user.name', 'Test curator');
  git('config', 'user.email', 'test@example.com');
  git('remote', 'add', 'origin', remote);
  await mkdir(path.join(repo, 'config'));
  await mkdir(path.join(repo, 'data/media/events'), { recursive: true });
  await writeFile(
    path.join(repo, 'config/media-ingestion.json'),
    JSON.stringify({
      events: [{ eventId: '2026-finals', sources: [{ type: 'feed', feedId: 1 }] }],
    }),
  );
  await writeFile(path.join(repo, target), 'baseline\n');
  git('add', '.');
  git('commit', '-m', 'baseline');
  git('push', '-u', 'origin', 'main');
  await writeFile(
    path.join(bin, 'gh'),
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args[0] === 'pr' && args[1] === 'list') {
  console.log(process.env.TEST_PR_NUMBER || '');
} else if (args[0] === 'pr' || args[0] === 'workflow') {
  fs.appendFileSync(process.env.TEST_GH_LOG, JSON.stringify(args) + '\\n');
  if (args[0] === 'workflow' && process.env.TEST_DISPATCH_FAIL === 'true') process.exit(1);
}
`,
    { mode: 0o755 },
  );
  await writeFile(path.join(root, 'media-ingestion-summary.txt'), '{"added":1}\n');
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH ?? ''}`,
    GITHUB_OUTPUT: output,
    GH_REPO: 'example/repo',
    BASE_BRANCH: 'main',
    MEDIA_BRANCH: branch,
    RUNNER_TEMP: root,
    TEST_GH_LOG: log,
    HUSKY: '0',
  };
  const run = (command: string, extra: Record<string, string> = {}) =>
    execFileSync(tsx, [cli, command], {
      cwd: repo,
      env: { ...env, ...extra },
      encoding: 'utf8',
      stdio: 'pipe',
    });
  const commitData = async (contents = 'curator edit\n') => {
    git('switch', '-c', branch);
    await writeFile(path.join(repo, target), contents);
    git('add', target);
    git('commit', '-m', 'curated import');
    git('push', 'origin', branch);
    git('switch', 'main');
  };
  return { root, repo, remote, git, run, output, log, commitData };
};

describe('ingestion workflow git operations', () => {
  it('is default-branch only, grants job-scoped permissions, and dispatches read-only CI', () => {
    expect(workflow).toContain("cron: '17 12 * * *'");
    expect(workflow).toContain("vars.MEDIA_INGESTION_SCHEDULE_ENABLED == 'true'");
    expect(workflow).toContain('github.ref_name == github.event.repository.default_branch');
    expect(workflow).toContain('cancel-in-progress: false');
    expect(workflow).toContain('contents: read');
    expect(workflow).toContain('      contents: write');
    expect(workflow).toContain('      pull-requests: write');
    expect(workflow).toContain('      actions: write');
    expect(workflow).toContain('GH_TOKEN: ${{ github.token }}');
    expect(workflow).not.toContain('create-github-app-token');
    expect(workflow).not.toContain('MEDIA_INGESTION_APP');
    expect(ciWorkflow).toContain('  workflow_dispatch:');
    expect(ciWorkflow).toContain('  contents: read');
    expect(ciWorkflow).not.toContain('contents: write');
    expect(workflow).not.toContain('pull_request_target');
    expect(workflow).not.toContain('--force');
    expect(workflow).toContain('run: npm run media:pull-request -- prepare');
    expect(workflow).toContain('run: npm run media:pull-request -- publish');
  });

  it('rejects unknown commands and missing environment', () => {
    expect(() => execFileSync(tsx, [cli, 'unknown'], { encoding: 'utf8', stdio: 'pipe' })).toThrow(
      'Usage: media-pull-request.ts <prepare|publish>',
    );
    expect(() =>
      execFileSync(tsx, [cli, 'publish'], {
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env, BASE_BRANCH: '', MEDIA_BRANCH: '' },
      }),
    ).toThrow('BASE_BRANCH must be set');
  });

  it('creates an initial data-only branch and PR', async () => {
    const { root, repo, git, run, log } = await setup();
    const summary = JSON.stringify({
      added: 1,
      incomplete: [
        { query: 'feed 1, all platforms', page: 20, retained: 1, reason: 'page limit reached' },
      ],
    });
    await writeFile(path.join(root, 'media-ingestion-summary.txt'), `${summary}\n`);
    run(prepare);
    await writeFile(path.join(repo, target), 'new post\n');
    run(publish, { COMPARISON: 'HEAD', PR_NUMBER: '' });
    expect(git('show', `origin/${branch}:${target}`)).toBe('new post');
    const commands = await readFile(log, 'utf8');
    expect(commands).toContain('"create"');
    expect(commands).toContain(`["workflow","run","ci.yml","--ref","${branch}"]`);
    expect(commands.indexOf('"create"')).toBeLessThan(commands.indexOf('"workflow"'));
    const body = await readFile(path.join(root, 'media-ingestion-pr.md'), 'utf8');
    expect(body).toContain('Queries may be incomplete');
    expect(body).toContain(summary);
  });

  it('preserves curator data, updates the open PR, and makes no repeat commit', async () => {
    const { repo, git, run, log, output, commitData } = await setup();
    await commitData();
    run(prepare, { TEST_PR_NUMBER: '7' });
    expect(await readFile(output, 'utf8')).toContain(`comparison=origin/${branch}`);
    expect(await readFile(path.join(repo, target), 'utf8')).toBe('curator edit\n');
    const original = git('rev-parse', `origin/${branch}`);
    run(publish, { COMPARISON: `origin/${branch}`, PR_NUMBER: '7' });
    expect(git('rev-parse', `origin/${branch}`)).toBe(original);
    await expect(readFile(log, 'utf8')).rejects.toThrow('ENOENT');
    await writeFile(path.join(repo, target), 'curator edit\nnew post\n');
    run(publish, { COMPARISON: `origin/${branch}`, PR_NUMBER: '7' });
    expect(git('show', `origin/${branch}:${target}`)).toBe('curator edit\nnew post');
    expect(git('merge-base', '--is-ancestor', original, `origin/${branch}`)).toBe('');
    const commands = await readFile(log, 'utf8');
    expect(commands).toContain('"edit","7"');
    expect(commands).toContain(`["workflow","run","ci.yml","--ref","${branch}"]`);
    expect(commands.indexOf('"edit"')).toBeLessThan(commands.indexOf('"workflow"'));
  });

  it('surfaces dispatch failures after publishing so CI can be started manually', async () => {
    const { repo, git, run, log } = await setup();
    run(prepare);
    await writeFile(path.join(repo, target), 'new post\n');
    expect(() =>
      run(publish, {
        COMPARISON: 'HEAD',
        PR_NUMBER: '',
        TEST_DISPATCH_FAIL: 'true',
      }),
    ).toThrow();
    expect(git('show', `origin/${branch}:${target}`)).toBe('new post');
    expect(await readFile(log, 'utf8')).toContain('"workflow","run","ci.yml"');
  });

  it('rejects unrelated changes on an existing PR or generated worktree', async () => {
    const { repo, git, run, commitData } = await setup();
    await commitData();
    git('switch', branch);
    await writeFile(path.join(repo, 'config/media-ingestion.json'), '{}');
    git('add', '.');
    git('commit', '-m', 'unrelated change');
    git('push', 'origin', branch);
    git('switch', 'main');
    expect(() => run(prepare, { TEST_PR_NUMBER: '7' })).toThrow(
      'Existing PR has unrelated changes; resolve it manually before ingestion: config/media-ingestion.json',
    );
    await writeFile(path.join(repo, 'config/media-ingestion.json'), '{"events": []}');
    expect(() => run(publish, { COMPARISON: 'HEAD', PR_NUMBER: '' })).toThrow(
      'Refusing to commit unrelated changes: config/media-ingestion.json',
    );
  });

  it('blocks leftover unmerged branches and merge conflicts', async () => {
    const { repo, git, run, commitData } = await setup();
    await commitData();
    expect(() => run(prepare)).toThrow(`An unmerged ${branch} branch exists without an open PR`);
    await writeFile(path.join(repo, target), 'conflicting default-branch correction\n');
    git('add', '.');
    git('commit', '-m', 'default correction');
    expect(() => run(prepare, { TEST_PR_NUMBER: '7' })).toThrow();
  });

  it('does not overwrite a concurrent remote curator update', async () => {
    const { root, repo, remote, git, run, commitData } = await setup();
    await commitData();
    run(prepare, { TEST_PR_NUMBER: '7' });
    const other = path.join(root, 'other');
    execFileSync('git', ['clone', '-b', branch, remote, other], { stdio: 'pipe' });
    const otherGit = (...args: string[]) =>
      execFileSync('git', args, { cwd: other, stdio: 'pipe' });
    otherGit('config', 'user.name', 'Another curator');
    otherGit('config', 'user.email', 'other@example.com');
    await writeFile(path.join(other, target), 'concurrent remote correction\n');
    otherGit('add', '.');
    otherGit('commit', '-m', 'concurrent edit');
    otherGit('push', 'origin', branch);
    await writeFile(path.join(repo, target), 'curator edit\nnew post\n');
    expect(() => run(publish, { COMPARISON: `origin/${branch}`, PR_NUMBER: '7' })).toThrow();
    git('fetch', 'origin', branch);
    expect(git('show', `origin/${branch}:${target}`)).toBe('concurrent remote correction');
  });
});
