import { execFileSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { describe, expect, it, vi } from 'vitest';

import {
  formatProposalPullRequestBody,
  isPublishableProposal,
  isVersionedProposalPath,
  main,
  runCli,
} from './pull-request';

import type { ReviewProposal } from '@/features/scoreboards/ingestion/schemas';

const completeProposal: ReviewProposal = {
  schemaVersion: 1,
  runId: 'run-20261031-test',
  generatedAt: '2026-10-31T12:00:00Z',
  status: 'complete',
  candidates: [],
  additions: [],
  seasonStandingCandidates: [],
  seasonStandingAdditions: [],
  identityProposals: [],
  conflicts: [],
  seasonStandingConflicts: [],
  runIssues: [],
  sourceFailures: [],
};

const seasonStandingCandidate: ReviewProposal['seasonStandingCandidates'][number] = {
  candidateId: 'iteso-gpm-2025-abc123',
  sourceId: 'iteso',
  authorityId: 'iteso',
  discoveryUrl: 'https://eventos.iteso.mx/acm/',
  finalUrl: 'https://acm.iteso.mx/share/result.pdf',
  retrievedAt: '2026-10-31T12:00:00Z',
  contentSha256: 'b'.repeat(64),
  parserVersion: 'iteso-season-standing-v1',
  sourceEditionLabel: '2025',
  seasonYear: 2025,
  seriesId: 'gpm',
  snapshot: 'latest-explicit',
  scoreUnit: 'Puntos',
  rows: [
    {
      place: 1,
      sourceTeamId: 'Equipo Alpha',
      teamName: 'Equipo Alpha',
      schoolName: null,
      score: 12.5,
      scoreText: '12.5',
      scoreUnit: 'Puntos',
      qualificationText: 'Sí',
      qualified: true,
      pageNumber: 1,
      confidence: 0.96,
      evidence: [
        {
          field: 'rows[0].place',
          kind: 'pdf-text',
          locator: 'page 1 row 1 place',
          page: 1,
          excerpt: '1',
          confidence: 0.96,
        },
        {
          field: 'rows[0].teamName',
          kind: 'pdf-text',
          locator: 'page 1 row 1 team name',
          page: 1,
          excerpt: 'Equipo Alpha',
          confidence: 0.96,
        },
        {
          field: 'rows[0].score',
          kind: 'pdf-text',
          locator: 'page 1 row 1 score',
          page: 1,
          excerpt: '12.5',
          confidence: 0.96,
        },
      ],
    },
  ],
  pageNumbers: [1],
  coverage: { expectedRowCount: 1, rowsComplete: true, pagesComplete: true },
  warnings: ['OCR confidence is 0.96.'],
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

  it('publishes season-standing-only conflicts for identity review', () => {
    expect(
      isPublishableProposal({
        ...completeProposal,
        seasonStandingConflicts: [
          {
            seasonYear: 2025,
            seriesId: 'gpm',
            entityId: 'Equipo Alpha',
            field: 'teamId',
            kind: 'identity',
            currentValue: null,
            alternatives: [
              { candidateId: 'iteso-gpm-2025-id', value: 'Equipo Alpha', evidence: [] },
            ],
          },
        ],
      }),
    ).toBe(true);
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
    expect(body).toContain('contest additions: 0');
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

  it('formats source-native season-standing candidate details and additions', () => {
    const proposal: ReviewProposal = {
      ...completeProposal,
      seasonStandingCandidates: [seasonStandingCandidate],
      seasonStandingAdditions: [{ candidateId: seasonStandingCandidate.candidateId, rowIndex: 0 }],
    };
    const body = formatProposalPullRequestBody([proposal], 'https://github.com/actions/runs/1');
    expect(body).toContain('#### Season standing `iteso-gpm-2025-abc123`');
    expect(body).toContain('2025 gpm; snapshot: latest-explicit');
    expect(body).toContain('Rows: 1; score unit: `Puntos`');
    expect(body).toContain('season-standing additions: 1');
    expect(body).toContain('Warning: `OCR confidence is 0.96.`');
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
      const unsafeInput = path.join(
        temporaryRoot,
        '.standings-ingestion/proposals/run..unsafe.json',
      );
      await writeFile(unsafeInput, JSON.stringify(conflictOnlyProposal));
      await expect(runPublisher(temporaryRoot, ['publish', unsafeInput], options)).rejects.toThrow(
        'Proposal file name is not safe to publish',
      );
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  it('skips an empty publish invocation without committing or updating a PR', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'standings-pr-empty-'));
    const options: PublisherEnvironment = {
      fakeBin: temporaryRoot,
      fakeGhLog: path.join(temporaryRoot, 'gh.log'),
      fakePrNumber: '',
      comparison: 'HEAD',
      githubOutput: path.join(temporaryRoot, 'github-output'),
      runnerTemp: temporaryRoot,
    };
    try {
      await expect(runPublisher(temporaryRoot, ['publish'], options)).resolves.toBeUndefined();
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  it('publishes unresolved identity proposals with source identifiers and names', () => {
    const proposal = {
      ...completeProposal,
      identityProposals: [
        {
          candidateId: 'iteso-gpm-2025-id',
          rowIndex: 0,
          sourceId: 'iteso',
          seasonYear: 2025,
          sourceTeamId: 'Equipo Alpha',
          teamName: 'Equipo Alpha',
          sourceSchoolId: null,
          schoolName: null,
        },
      ],
    };
    expect(isPublishableProposal(proposal)).toBe(true);
    const body = formatProposalPullRequestBody([proposal], 'https://github.com/actions/runs/1');
    expect(body).toContain('Identity proposals: 1');
    expect(body).toContain('Identity review (`iteso`, 2025)');
    expect(body).toContain('team `Equipo Alpha` [source ID: `Equipo Alpha`]');
    expect(body).toContain('school `unresolved`');
  });

  it('fails closed when the proposal output parent is not a directory', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'standings-pr-output-path-'));
    const inputDirectory = path.join(temporaryRoot, '.standings-ingestion/proposals');
    await mkdir(inputDirectory, { recursive: true });
    const inputPath = path.join(inputDirectory, 'run-invalid-output.json');
    await writeFile(
      inputPath,
      JSON.stringify({
        ...completeProposal,
        status: 'partial',
        seasonStandingCandidates: [seasonStandingCandidate],
      }),
    );
    await writeFile(path.join(temporaryRoot, 'proposals'), 'not a directory');
    const options: PublisherEnvironment = {
      fakeBin: temporaryRoot,
      fakeGhLog: path.join(temporaryRoot, 'gh.log'),
      fakePrNumber: '',
      comparison: 'HEAD',
      githubOutput: path.join(temporaryRoot, 'github-output'),
      runnerTemp: temporaryRoot,
    };
    try {
      await expect(runPublisher(temporaryRoot, ['publish', inputPath], options)).rejects.toThrow(
        /ENOTDIR/,
      );
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

  it('requires publisher environment before preparing a branch', async () => {
    const previousArguments = process.argv;
    const previousBaseBranch = process.env.BASE_BRANCH;
    process.argv = [process.execPath, 'pull-request.ts', 'prepare'];
    Reflect.deleteProperty(process.env, 'BASE_BRANCH');
    try {
      await expect(main()).rejects.toThrow('BASE_BRANCH must be set');
    } finally {
      process.argv = previousArguments;
      if (previousBaseBranch === undefined) {
        Reflect.deleteProperty(process.env, 'BASE_BRANCH');
      } else {
        process.env.BASE_BRANCH = previousBaseBranch;
      }
    }
  });

  it('reports CLI errors using the Actions annotation and sets a failing exit code', async () => {
    const previousExitCode = process.exitCode;
    const previousActions = process.env.GITHUB_ACTIONS;
    const errorOutput = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.GITHUB_ACTIONS = 'true';
    try {
      await runCli(() => Promise.reject(new Error('publisher failed')));
      expect(errorOutput).toHaveBeenCalledWith('::error::publisher failed');
      expect(process.exitCode).toBe(1);
    } finally {
      errorOutput.mockRestore();
      if (previousActions === undefined) {
        Reflect.deleteProperty(process.env, 'GITHUB_ACTIONS');
      } else {
        process.env.GITHUB_ACTIONS = previousActions;
      }
      if (previousExitCode === undefined) {
        Reflect.deleteProperty(process, 'exitCode');
      } else {
        process.exitCode = previousExitCode;
      }
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
