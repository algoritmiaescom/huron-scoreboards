import { execFileSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { describe, expect, it } from 'vitest';

import {
  formatProposalPullRequestBody,
  isPublishableProposal,
  isVersionedProposalPath,
  main,
} from './pull-request';

import type { ReviewProposal } from '@/features/scoreboards/ingestion/schemas';

const completeProposal: ReviewProposal = {
  schemaVersion: 1,
  runId: 'run-20261031-test',
  generatedAt: '2026-10-31T12:00:00Z',
  status: 'complete',
  candidates: [],
  additions: [],
  conflicts: [],
  runIssues: [],
  sourceFailures: [],
};

const conflictOnlyProposal: ReviewProposal = {
  ...completeProposal,
  candidates: [
    {
      candidateId: 'candidate-m8',
      sourceId: 'icpc-global-finder',
      authorityId: 'icpc-global',
      discoveryUrl: 'https://icpc.global/regionals/finder/mexico',
      finalUrl: 'https://icpc.global/regionals/finder/Mexico-2026/standings',
      retrievedAt: '2026-10-31T12:00:00Z',
      contentSha256: 'a'.repeat(64),
      parserVersion: 'icpc-global-v1',
      promptVersion: null,
      model: null,
      sourceEditionLabel: '2025',
      contest: {
        seasonYear: 2025,
        seriesId: 'mexico-finals',
        stage: 'final',
        name: 'Mexico Finals',
        publicationState: 'final',
        date: null,
        durationMinutes: null,
        penaltyMinutesPerFailedAttempt: null,
        problemLabels: [],
      },
      rows: [
        {
          place: 1,
          sourceTeamId: null,
          teamName: 'Team Alpha',
          sourceSchoolId: null,
          schoolName: 'School Alpha',
          results: null,
          publishedTotals: { solved: 1, penalty: 10 },
          evidence: [
            {
              field: 'rows[0].place',
              kind: 'html-cell',
              locator: 'table tr:nth-of-type(2) td:nth-of-type(1)',
              page: null,
              excerpt: '1',
              confidence: 1,
            },
          ],
        },
      ],
      coverage: { expectedRowCount: 1, rowsComplete: true, paginationComplete: true },
      warnings: [],
    },
  ],
  conflicts: [
    {
      contest: { seasonYear: 2025, seriesId: 'mexico-finals', stage: 'final' },
      entityId: 'team-alpha',
      field: 'place',
      kind: 'archive',
      currentValue: '2',
      alternatives: [
        {
          candidateId: 'candidate-m8',
          value: '1',
          evidence: [
            {
              field: 'rows[0].place',
              kind: 'html-cell',
              locator: 'table tr:nth-of-type(2) td:nth-of-type(1)',
              page: null,
              excerpt: '1',
              confidence: 1,
            },
          ],
        },
      ],
    },
  ],
};

interface PublisherEnvironment {
  fakeBin: string;
  fakeGhLog: string;
  fakePrNumber: string;
  comparison: string;
  githubOutput: string;
  runnerTemp: string;
}

const runGit = (cwd: string, ...args: string[]): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

const runPublisher = async (
  cwd: string,
  args: string[],
  options: PublisherEnvironment,
): Promise<void> => {
  const previousDirectory = process.cwd();
  const previousArguments = process.argv;
  const environment = {
    PATH: `${options.fakeBin}:${process.env.PATH ?? ''}`,
    GH_TOKEN: 'offline-test-token',
    GH_REPO: 'example/huron-scoreboards',
    BASE_BRANCH: 'main',
    STANDINGS_BRANCH: 'automation/standings-ingestion',
    COMPARISON: options.comparison,
    PR_NUMBER: options.fakePrNumber,
    GITHUB_OUTPUT: options.githubOutput,
    GITHUB_SERVER_URL: 'https://github.com',
    GITHUB_RUN_ID: '12345',
    RUNNER_TEMP: options.runnerTemp,
    FAKE_GH_LOG: options.fakeGhLog,
    FAKE_PR_NUMBER: options.fakePrNumber,
  };
  const previousEnvironment = Object.fromEntries(
    Object.keys(environment).map((key) => [key, process.env[key]]),
  );
  process.chdir(cwd);
  process.argv = [process.execPath, path.join(cwd, 'pull-request.ts'), ...args];
  Object.assign(process.env, environment);
  try {
    await main();
  } finally {
    process.chdir(previousDirectory);
    process.argv = previousArguments;
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = value;
      }
    }
  }
};

describe('standings proposal PR publishing', () => {
  it('only accepts direct proposal JSON paths in the dedicated review directory', () => {
    expect(isVersionedProposalPath('proposals/standings-ingestion/run-1.json')).toBe(true);
    expect(isVersionedProposalPath('proposals/standings-ingestion/nested/run-1.json')).toBe(false);
    expect(isVersionedProposalPath('data/seasons/2025/final.json')).toBe(false);
    expect(isVersionedProposalPath('proposals/standings-ingestion/../../data.json')).toBe(false);
  });

  it('publishes conflict-only or partial reports but not empty failed source runs', () => {
    expect(isPublishableProposal(completeProposal)).toBe(false);
    expect(isPublishableProposal(conflictOnlyProposal)).toBe(true);
    expect(
      isPublishableProposal({
        ...completeProposal,
        status: 'partial',
        sourceFailures: [
          { sourceId: 'icpc-global-finder', contest: null, message: 'Missing row.' },
        ],
      }),
    ).toBe(true);
    expect(
      isPublishableProposal({
        ...completeProposal,
        status: 'failed',
        sourceFailures: [{ sourceId: 'icpc-global-finder', contest: null, message: 'Timed out.' }],
      }),
    ).toBe(false);
  });

  it('formats a review body with summary counts, source failures, and artifact link', () => {
    const proposal: ReviewProposal = {
      ...conflictOnlyProposal,
      status: 'partial' as const,
      candidates: conflictOnlyProposal.candidates.map((candidate) => ({
        ...candidate,
        warnings: ['Candidate needs review.'],
      })),
      conflicts: conflictOnlyProposal.conflicts.map((conflict) => ({
        ...conflict,
        kind: 'identity' as const,
      })),
      runIssues: [{ kind: 'configuration', message: 'A source mapping needs review.' }],
      sourceFailures: [
        {
          sourceId: 'icpc-global-finder',
          contest: { seasonYear: 2025, seriesId: 'mexico-finals', stage: 'final' },
          message: 'Eight rows have no place.',
        },
      ],
    };
    const body = formatProposalPullRequestBody(
      [proposal],
      'https://github.com/example/repo/actions/runs/123',
    );
    expect(body).toContain('review proposals only');
    expect(body).toContain('proposed additions: 0');
    expect(body).toContain('Candidate rows: 1');
    expect(body).toContain('Conflicts: 1 (1 identity)');
    expect(body).toContain('candidate warnings: 1');
    expect(body).toContain('Run issue (configuration)');
    expect(body).toContain('2025 mexico-finals/final');
    expect(body).toContain('Source failures: 1');
    expect(body).toContain('Eight rows have no place.');
    expect(body).toContain('https://github.com/example/repo/actions/runs/123');
    expect(body).toContain('approvals and merges are manual');
  });

  it('rejects proposal inputs outside the input root and directory inputs', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'standings-pr-input-'));
    const options: PublisherEnvironment = {
      fakeBin: temporaryRoot,
      fakeGhLog: path.join(temporaryRoot, 'gh.log'),
      fakePrNumber: '',
      comparison: 'HEAD',
      githubOutput: path.join(temporaryRoot, 'github-output'),
      runnerTemp: temporaryRoot,
    };
    try {
      await expect(
        runPublisher(temporaryRoot, ['publish', path.join(temporaryRoot, 'outside.json')], options),
      ).rejects.toThrow('Proposal input must be under');
      const directoryInput = path.join(
        temporaryRoot,
        '.standings-ingestion/proposals/directory.json',
      );
      await mkdir(directoryInput, { recursive: true });
      await expect(
        runPublisher(temporaryRoot, ['publish', directoryInput], options),
      ).rejects.toThrow('Proposal input exceeds');
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  it('rejects unsupported publisher commands with usage information', async () => {
    const previousArguments = process.argv;
    process.argv = [process.execPath, 'pull-request.ts', 'unsupported'];
    try {
      await expect(main()).rejects.toThrow('Usage: standings-ingestion/pull-request.ts');
    } finally {
      process.argv = previousArguments;
    }
  });

  it('appends proposals to a stable local PR branch without overwriting reviewer edits', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'standings-pr-publish-'));
    const remote = path.join(temporaryRoot, 'remote.git');
    const initialCheckout = path.join(temporaryRoot, 'initial');
    const reviewerCheckout = path.join(temporaryRoot, 'reviewer');
    const followupCheckout = path.join(temporaryRoot, 'followup');
    const fakeBin = path.join(temporaryRoot, 'bin');
    const runnerTemp = path.join(temporaryRoot, 'runner-temp');
    const fakeGhLog = path.join(temporaryRoot, 'gh.log');
    const githubOutput = path.join(temporaryRoot, 'github-output');
    const branch = 'automation/standings-ingestion';
    try {
      await Promise.all([
        mkdir(fakeBin, { recursive: true }),
        mkdir(runnerTemp, { recursive: true }),
      ]);
      await writeFile(
        path.join(fakeBin, 'gh'),
        '#!/bin/sh\nprintf \'%s\\n\' "$*" >> "$FAKE_GH_LOG"\nif [ "$1" = "pr" ] && [ "$2" = "list" ]; then printf \'%s\\n\' "${FAKE_PR_NUMBER:-}"; fi\n',
      );
      await chmod(path.join(fakeBin, 'gh'), 0o755);
      execFileSync('git', ['init', '--bare', '--initial-branch=main', remote], { stdio: 'ignore' });
      execFileSync('git', ['clone', remote, initialCheckout], { stdio: 'ignore' });
      await writeFile(path.join(initialCheckout, 'README.md'), 'base\n');
      await writeFile(path.join(initialCheckout, '.gitignore'), '.standings-ingestion/\n');
      runGit(initialCheckout, 'config', 'user.name', 'M8 test');
      runGit(initialCheckout, 'config', 'user.email', 'm8-test@example.test');
      runGit(initialCheckout, 'add', 'README.md', '.gitignore');
      runGit(initialCheckout, 'commit', '-m', 'base');
      runGit(initialCheckout, 'push', 'origin', 'main');

      const firstInputDirectory = path.join(initialCheckout, '.standings-ingestion/proposals');
      await mkdir(firstInputDirectory, { recursive: true });
      const firstProposalPath = path.join(firstInputDirectory, 'run-m8-one.json');
      await writeFile(
        firstProposalPath,
        JSON.stringify({
          ...completeProposal,
          runId: 'run-m8-one',
          status: 'partial',
          sourceFailures: [
            { sourceId: 'icpc-global-finder', contest: null, message: 'One source needs review.' },
          ],
        }),
      );
      const commonEnvironment: Omit<PublisherEnvironment, 'fakePrNumber' | 'comparison'> = {
        fakeBin,
        fakeGhLog,
        githubOutput,
        runnerTemp,
      };
      await runPublisher(initialCheckout, ['prepare'], {
        ...commonEnvironment,
        fakePrNumber: '',
        comparison: 'HEAD',
      });
      await runPublisher(initialCheckout, ['publish', firstProposalPath], {
        ...commonEnvironment,
        fakePrNumber: '',
        comparison: 'HEAD',
      });
      await runPublisher(initialCheckout, ['publish', firstProposalPath], {
        ...commonEnvironment,
        fakePrNumber: '',
        comparison: 'HEAD',
      });
      const rejectedInputPath = path.join(firstInputDirectory, 'run-m8-rejected.json');
      const rejectedOutputPath = path.join(
        initialCheckout,
        'proposals/standings-ingestion/run-m8-rejected.json',
      );
      await writeFile(
        rejectedInputPath,
        JSON.stringify({
          ...completeProposal,
          runId: 'run-m8-rejected',
          status: 'partial',
          sourceFailures: [
            { sourceId: 'icpc-global-finder', contest: null, message: 'Needs review.' },
          ],
        }),
      );
      await writeFile(path.join(initialCheckout, 'README.md'), 'unexpected change\n');
      await expect(
        runPublisher(initialCheckout, ['publish', rejectedInputPath], {
          ...commonEnvironment,
          fakePrNumber: '',
          comparison: 'HEAD',
        }),
      ).rejects.toThrow('Refusing to publish unrelated changes: README.md');
      await writeFile(path.join(initialCheckout, 'README.md'), 'base\n');
      await rm(rejectedInputPath, { force: true });
      await rm(rejectedOutputPath, { force: true });
      const publishedProposalPath = 'proposals/standings-ingestion/run-m8-one.json';
      const reviewerProposal = JSON.parse(
        execFileSync('git', ['--git-dir', remote, 'show', `${branch}:${publishedProposalPath}`], {
          encoding: 'utf8',
        }),
      ) as ReviewProposal;
      expect(reviewerProposal.runId).toBe('run-m8-one');

      execFileSync('git', ['clone', '--branch', branch, remote, reviewerCheckout], {
        stdio: 'ignore',
      });
      const reviewerFile = path.join(reviewerCheckout, publishedProposalPath);
      const reviewerEdit = JSON.parse(await readFile(reviewerFile, 'utf8')) as ReviewProposal;
      await writeFile(
        reviewerFile,
        `${JSON.stringify({ ...reviewerEdit, generatedAt: '2026-10-31T13:00:00Z' })}\n`,
      );
      runGit(reviewerCheckout, 'config', 'user.name', 'Reviewer');
      runGit(reviewerCheckout, 'config', 'user.email', 'reviewer@example.test');
      runGit(reviewerCheckout, 'add', publishedProposalPath);
      runGit(reviewerCheckout, 'commit', '-m', 'review proposal metadata');
      runGit(reviewerCheckout, 'push', 'origin', branch);

      execFileSync('git', ['clone', '--branch', 'main', remote, followupCheckout], {
        stdio: 'ignore',
      });
      const secondInputDirectory = path.join(followupCheckout, '.standings-ingestion/proposals');
      await mkdir(secondInputDirectory, { recursive: true });
      const secondProposalPath = path.join(secondInputDirectory, 'run-m8-two.json');
      await writeFile(
        secondProposalPath,
        JSON.stringify({
          ...completeProposal,
          runId: 'run-m8-two',
          status: 'partial',
          sourceFailures: [
            {
              sourceId: 'icpc-global-finder',
              contest: null,
              message: 'Another source needs review.',
            },
          ],
        }),
      );
      const followupOutput = path.join(temporaryRoot, 'github-output-followup');
      await expect(
        runPublisher(followupCheckout, ['prepare'], {
          ...commonEnvironment,
          githubOutput: followupOutput,
          fakePrNumber: '',
          comparison: 'HEAD',
        }),
      ).rejects.toThrow(
        'An unmerged automation/standings-ingestion branch exists without an open PR',
      );
      await runPublisher(followupCheckout, ['prepare'], {
        ...commonEnvironment,
        githubOutput: followupOutput,
        fakePrNumber: '42',
        comparison: 'HEAD',
      });
      const outputText = await readFile(followupOutput, 'utf8');
      const comparison = /^comparison=(.+)$/m.exec(outputText)?.[1];
      expect(comparison).toBe(`origin/${branch}`);
      await runPublisher(followupCheckout, ['publish', secondProposalPath], {
        ...commonEnvironment,
        githubOutput: followupOutput,
        fakePrNumber: '42',
        comparison: comparison ?? 'HEAD',
      });

      const preservedProposal = JSON.parse(
        execFileSync('git', ['--git-dir', remote, 'show', `${branch}:${publishedProposalPath}`], {
          encoding: 'utf8',
        }),
      ) as ReviewProposal;
      expect(preservedProposal.generatedAt).toBe('2026-10-31T13:00:00Z');
      expect(
        execFileSync(
          'git',
          ['--git-dir', remote, 'show', `${branch}:proposals/standings-ingestion/run-m8-two.json`],
          { encoding: 'utf8' },
        ),
      ).toContain('run-m8-two');
      const ghCalls = await readFile(fakeGhLog, 'utf8');
      expect(ghCalls).toContain('pr comment 42 --body-file');
      expect(ghCalls).not.toContain('pr edit 42');
      expect(ghCalls).toContain('workflow run ci.yml --ref automation/standings-ingestion');
      expect(ghCalls).not.toMatch(/pr merge|pr review --approve/);
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });
});
