import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// Runs from the trusted default-branch checkout in the media ingestion workflow; `prepare` only
// merges an existing automation branch after confirming it changes nothing but event data.

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`${name} must be set`);
  }
  return value;
};

const exec = (command: string, args: string[]): string =>
  execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();

// For commands that report a boolean through exit status 1, such as `git diff --quiet`.
const succeeds = (command: string, args: string[]): boolean => {
  try {
    execFileSync(command, args, { stdio: ['ignore', 'ignore', 'inherit'] });
    return true;
  } catch (error) {
    if ((error as { status?: unknown }).status === 1) {
      return false;
    }
    throw error;
  }
};

const setOutput = (name: string, value: string): void => {
  appendFileSync(requireEnv('GITHUB_OUTPUT'), `${name}=${value}\n`);
};

const changedFiles = (args: string[]): string[] =>
  exec('git', ['diff', '--name-only', '-z', ...args])
    .split('\0')
    .filter((file) => file !== '');

const assertOnlyEventData = (files: string[], message: string): void => {
  const config: unknown = JSON.parse(readFileSync('config/media-ingestion.json', 'utf8'));
  const events: unknown = (config as { events?: unknown } | null)?.events;
  if (!Array.isArray(events)) {
    throw new Error('config/media-ingestion.json must contain an events array');
  }
  const allowed = new Set(
    events.map(
      (event) => `data/media/events/${String((event as { eventId?: unknown }).eventId)}.json`,
    ),
  );
  const unrelated = files.filter((file) => !allowed.has(file));
  if (unrelated.length > 0) {
    throw new Error(`${message}: ${unrelated.join(', ')}`);
  }
};

const prepare = (): void => {
  const base = requireEnv('BASE_BRANCH');
  const branch = requireEnv('MEDIA_BRANCH');
  exec('gh', ['auth', 'setup-git']);
  exec('git', ['config', 'user.name', 'Huron Media Ingestion']);
  exec('git', ['config', 'user.email', 'media-ingestion@users.noreply.github.com']);
  const number = exec('gh', [
    ...['pr', 'list', '--head', branch, '--base', base, '--state', 'open'],
    ...['--json', 'number', '--jq', '.[0].number // empty'],
  ]);
  setOutput('number', number);
  const remoteBranch = `origin/${branch}`;
  const fetchBranch = () => {
    exec('git', ['fetch', 'origin', `${branch}:refs/remotes/${remoteBranch}`]);
  };
  if (number !== '') {
    fetchBranch();
    assertOnlyEventData(
      changedFiles([`HEAD...${remoteBranch}`]),
      'Existing PR has unrelated changes; resolve it manually before ingestion',
    );
    exec('git', ['merge', '--no-ff', '--no-commit', remoteBranch]);
    setOutput('comparison', remoteBranch);
    return;
  }
  // Reuse a branch without an open PR only if it is already contained in the default branch.
  if (exec('git', ['ls-remote', '--heads', 'origin', branch]) !== '') {
    fetchBranch();
    if (!succeeds('git', ['merge-base', '--is-ancestor', remoteBranch, 'HEAD'])) {
      throw new Error(
        `An unmerged ${branch} branch exists without an open PR; resolve or delete it manually`,
      );
    }
  }
  setOutput('comparison', 'HEAD');
};

const pullRequestBody = (summary: string): string =>
  [
    '## Media ingestion',
    '',
    'Append-only Juicer import. Review attribution and media descriptions before merging.',
    '',
    'Existing posts and contributor edits are preserved. No automatic deletions or merge.',
    'Queries may be incomplete: review `incomplete` entries for failure reasons, pages, and retained counts.',
    '',
    '### Ingestion counts',
    '```text',
    summary.trimEnd(),
    '```',
    '',
  ].join('\n');

const publish = (): void => {
  const base = requireEnv('BASE_BRANCH');
  const branch = requireEnv('MEDIA_BRANCH');
  const comparison = requireEnv('COMPARISON');
  const number = process.env.PR_NUMBER ?? '';
  const temp = requireEnv('RUNNER_TEMP');
  const files = changedFiles(['HEAD']);
  assertOnlyEventData(files, 'Refusing to commit unrelated changes');
  for (const file of files) {
    exec('git', ['add', '--', file]);
  }
  if (succeeds('git', ['diff', '--quiet', comparison, '--', 'data/media/events'])) {
    console.log('No new media changes; no commit or PR update needed.');
    return;
  }
  const title = 'data: ingest social media posts';
  exec('git', [
    ...['commit', '-m', title],
    ...['-m', 'Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>'],
  ]);
  // No force push: concurrent curator updates must fail rather than be overwritten.
  exec('git', ['push', 'origin', `HEAD:refs/heads/${branch}`]);
  const bodyFile = path.join(temp, 'media-ingestion-pr.md');
  writeFileSync(
    bodyFile,
    pullRequestBody(readFileSync(path.join(temp, 'media-ingestion-summary.txt'), 'utf8')),
  );
  if (number !== '') {
    exec('gh', ['pr', 'edit', number, '--body-file', bodyFile]);
  } else {
    exec('gh', [
      ...['pr', 'create', '--base', base, '--head', branch],
      ...['--title', title, '--body-file', bodyFile],
    ]);
  }
  // GITHUB_TOKEN does not trigger push/PR CI; workflow_dispatch is an explicit exception.
  exec('gh', ['workflow', 'run', 'ci.yml', '--ref', branch]);
};

const commands: Partial<Record<string, () => void>> = { prepare, publish };

try {
  const command = commands[process.argv[2] ?? ''];
  if (command === undefined) {
    throw new Error('Usage: media-pull-request.ts <prepare|publish>');
  }
  command();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  // GitHub Actions turns `::error::` lines into run annotations.
  console.error(`${process.env.GITHUB_ACTIONS === 'true' ? '::error::' : ''}${message}`);
  process.exitCode = 1;
}
