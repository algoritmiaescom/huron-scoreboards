import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { reviewProposalSchema } from '@/features/scoreboards/ingestion/schemas';

import { writeJsonAtomically } from './operator';

import type { ReviewProposal } from '@/features/scoreboards/ingestion/schemas';

const MAX_PROPOSAL_BYTES = 64 * 1024 * 1024;
const PROPOSAL_INPUT_ROOT = '.standings-ingestion/proposals/';
const PROPOSAL_OUTPUT_ROOT = 'proposals/standings-ingestion';
const PROPOSAL_FILENAME = /^[a-z0-9][a-z0-9._-]*\.json$/;

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} must be set`);
  }
  return value;
};

const exec = (command: string, args: string[]): string =>
  execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();

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

const splitPaths = (value: string): string[] => value.split('\0').filter((file) => file.length > 0);

const changedFiles = (): string[] => [
  ...new Set([
    ...splitPaths(exec('git', ['diff', '--name-only', '-z', 'HEAD'])),
    ...splitPaths(exec('git', ['ls-files', '--others', '--exclude-standard', '-z'])),
  ]),
];

export const isVersionedProposalPath = (filePath: string): boolean =>
  filePath.startsWith(`${PROPOSAL_OUTPUT_ROOT}/`) &&
  !filePath.slice(PROPOSAL_OUTPUT_ROOT.length + 1).includes('/') &&
  PROPOSAL_FILENAME.test(path.basename(filePath));

const assertOnlyProposalFiles = (files: readonly string[], message: string): void => {
  const unrelated = files.filter((file) => !isVersionedProposalPath(file));
  if (unrelated.length > 0) {
    throw new Error(`${message}: ${unrelated.join(', ')}`);
  }
};

const readInputProposal = async (inputPath: string): Promise<ReviewProposal> => {
  const absolutePath = path.resolve(inputPath);
  const relativePath = path.relative(process.cwd(), absolutePath);
  if (!relativePath.startsWith(PROPOSAL_INPUT_ROOT)) {
    throw new Error(`Proposal input must be under ${PROPOSAL_INPUT_ROOT}: ${relativePath}`);
  }
  const fileStats = await stat(absolutePath);
  if (!fileStats.isFile() || fileStats.size > MAX_PROPOSAL_BYTES) {
    throw new Error(`Proposal input exceeds the ${String(MAX_PROPOSAL_BYTES)} byte limit.`);
  }
  return reviewProposalSchema.parse(JSON.parse(readFileSync(absolutePath, 'utf8')) as unknown);
};

export const isPublishableProposal = (proposal: ReviewProposal): boolean =>
  (proposal.candidates.length > 0 ||
    proposal.additions.length > 0 ||
    proposal.conflicts.length > 0 ||
    proposal.runIssues.length > 0 ||
    proposal.sourceFailures.length > 0) &&
  (proposal.status !== 'failed' || proposal.conflicts.length > 0 || proposal.runIssues.length > 0);

const inlineCode = (value: string): string =>
  `\`${value.replace(/[`\r\n]/g, ' ').slice(0, 1000)}\``;

export const formatProposalPullRequestBody = (
  proposals: readonly ReviewProposal[],
  runUrl: string,
): string => {
  const proposalSections = proposals.map((proposal) => {
    const sources = [
      ...new Set([
        ...proposal.candidates.map(({ sourceId }) => sourceId),
        ...proposal.sourceFailures.map(({ sourceId }) => sourceId),
      ]),
    ];
    const rowCount = proposal.candidates.reduce(
      (total, candidate) => total + candidate.rows.length,
      0,
    );
    const identityConflicts = proposal.conflicts.filter(({ kind }) => kind === 'identity').length;
    const warnings = proposal.candidates.reduce(
      (total, candidate) => total + candidate.warnings.length,
      0,
    );
    return [
      `### Run ${inlineCode(proposal.runId)}`,
      `- Status: ${proposal.status}`,
      `- Edition: ${
        proposal.candidates
          .map(({ contest }) => String(contest.seasonYear))
          .filter((year, index, years) => years.indexOf(year) === index)
          .join(', ') || 'not resolved'
      }`,
      `- Sources: ${sources.map(inlineCode).join(', ') || 'none'}`,
      `- Candidate rows: ${String(rowCount)}; proposed additions: ${String(proposal.additions.length)}`,
      `- Conflicts: ${String(proposal.conflicts.length)} (${String(identityConflicts)} identity); run issues: ${String(proposal.runIssues.length)}`,
      `- Source failures: ${String(proposal.sourceFailures.length)}; candidate warnings: ${String(warnings)}`,
      ...proposal.runIssues.map(
        ({ kind, message }) => `- Run issue (${kind}): ${inlineCode(message)}`,
      ),
      ...proposal.sourceFailures.map(
        ({ sourceId, contest, message }) =>
          `- Source failure (${inlineCode(sourceId)}${contest === null ? '' : `, ${String(contest.seasonYear)} ${contest.seriesId}/${contest.stage}`}): ${inlineCode(message)}`,
      ),
    ].join('\n');
  });
  return [
    '## Standings ingestion review',
    '',
    'This PR contains validated review proposals only. It does not modify published archive data; approvals and merges are manual.',
    'Candidate values, row/field conflicts, evidence locators, and alternative-source comparisons are in the versioned proposal JSON files in this PR.',
    `Rendered pages and downloaded documents are bounded workflow artifacts: ${runUrl}`,
    '',
    ...proposalSections,
    '',
  ].join('\n');
};

export const prepare = (): void => {
  const base = requireEnv('BASE_BRANCH');
  const branch = requireEnv('STANDINGS_BRANCH');
  exec('gh', ['auth', 'setup-git']);
  exec('git', ['config', 'user.name', 'Huron Standings Ingestion']);
  exec('git', ['config', 'user.email', 'standings-ingestion@users.noreply.github.com']);
  const number = exec('gh', [
    'pr',
    'list',
    '--head',
    branch,
    '--base',
    base,
    '--state',
    'open',
    '--json',
    'number',
    '--jq',
    '.[0].number // empty',
  ]);
  setOutput('number', number);
  const remoteBranch = `origin/${branch}`;
  const remoteExists = exec('git', ['ls-remote', '--heads', 'origin', branch]) !== '';
  if (!remoteExists) {
    setOutput('comparison', 'HEAD');
    return;
  }
  exec('git', ['fetch', 'origin', `${branch}:refs/remotes/${remoteBranch}`]);
  if (number !== '') {
    assertOnlyProposalFiles(
      splitPaths(exec('git', ['diff', '--name-only', '-z', `HEAD...${remoteBranch}`])),
      'Existing standings PR has unrelated changes; resolve it manually before ingestion',
    );
    exec('git', ['merge', '--no-ff', '--no-commit', remoteBranch]);
    setOutput('comparison', remoteBranch);
    return;
  }
  if (!succeeds('git', ['merge-base', '--is-ancestor', remoteBranch, 'HEAD'])) {
    throw new Error(
      `An unmerged ${branch} branch exists without an open PR; resolve it manually before ingestion`,
    );
  }
  setOutput('comparison', 'HEAD');
};

export const publish = async (inputPaths: readonly string[]): Promise<void> => {
  const base = requireEnv('BASE_BRANCH');
  const branch = requireEnv('STANDINGS_BRANCH');
  const comparison = requireEnv('COMPARISON');
  const prNumber = process.env.PR_NUMBER ?? '';
  const inputs = await Promise.all(
    inputPaths.map(async (inputPath) => ({
      inputPath,
      proposal: await readInputProposal(inputPath),
    })),
  );
  const publishable = inputs.filter(({ proposal }) => isPublishableProposal(proposal));
  if (publishable.length === 0) {
    console.log('No publishable standings proposals; no commit or PR update needed.');
    return;
  }
  for (const { inputPath: rawInputPath, proposal } of publishable) {
    const inputPath = path.resolve(rawInputPath);
    const fileName = path.basename(inputPath);
    if (!PROPOSAL_FILENAME.test(fileName) || fileName.includes('..')) {
      throw new Error(`Proposal file name is not safe to publish: ${fileName}`);
    }
    const outputPath = path.resolve(PROPOSAL_OUTPUT_ROOT, fileName);
    try {
      await stat(outputPath);
    } catch (error) {
      if ((error as { code?: unknown }).code !== 'ENOENT') {
        throw error;
      }
      await writeJsonAtomically(path.resolve(PROPOSAL_OUTPUT_ROOT), fileName, proposal);
    }
  }
  const files = changedFiles();
  assertOnlyProposalFiles(files, 'Refusing to publish unrelated changes');
  for (const file of files) {
    exec('git', ['add', '--', file]);
  }
  if (succeeds('git', ['diff', '--cached', '--quiet', comparison, '--', PROPOSAL_OUTPUT_ROOT])) {
    console.log('No new proposal changes; no commit or PR update needed.');
    return;
  }
  exec('git', ['config', 'user.name', 'Huron Standings Ingestion']);
  exec('git', ['config', 'user.email', 'standings-ingestion@users.noreply.github.com']);
  exec('git', [
    'commit',
    '-m',
    'data: publish standings review proposals',
    '-m',
    'Proposal-only update; published archive data is unchanged.',
  ]);
  exec('git', ['push', 'origin', `HEAD:refs/heads/${branch}`]);
  const runUrl = `${requireEnv('GITHUB_SERVER_URL')}/${requireEnv('GH_REPO')}/actions/runs/${requireEnv('GITHUB_RUN_ID')}`;
  const bodyFile = path.join(requireEnv('RUNNER_TEMP'), 'standings-ingestion-pr.md');
  writeFileSync(
    bodyFile,
    formatProposalPullRequestBody(
      publishable.map(({ proposal }) => proposal),
      runUrl,
    ),
  );
  const title = 'data: review standings ingestion proposals';
  if (prNumber.length > 0) {
    exec('gh', ['pr', 'comment', prNumber, '--body-file', bodyFile]);
  } else {
    exec('gh', [
      'pr',
      'create',
      '--base',
      base,
      '--head',
      branch,
      '--title',
      title,
      '--body-file',
      bodyFile,
    ]);
  }
  exec('gh', ['workflow', 'run', 'ci.yml', '--ref', branch]);
};

export const main = async (): Promise<void> => {
  const command = process.argv[2];
  if (command === 'prepare') {
    prepare();
  } else if (command === 'publish') {
    await publish(process.argv.slice(3));
  } else {
    throw new Error(
      'Usage: standings-ingestion/pull-request.ts <prepare|publish> [proposal.json ...]',
    );
  }
};

if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${process.env.GITHUB_ACTIONS === 'true' ? '::error::' : ''}${message}`);
    process.exitCode = 1;
  }
}
