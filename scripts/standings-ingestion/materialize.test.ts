import { mkdir, mkdtemp, readFile, rm, symlink, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { archiveFiles } from '@/test/fixtures/archive';

import { materializeProposalFiles } from './materialize';

const createRoot = async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'standings-draft-test-'));
  for (const [file, load] of Object.entries(archiveFiles('archive'))) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), await load());
  }
  await mkdir(path.join(root, 'config'));
  await writeFile(path.join(root, 'config/standings-sources.json'), '{}');
  await writeFile(
    path.join(root, 'config/standings-identities.json'),
    JSON.stringify({ schemaVersion: 1, aliases: [] }),
  );
  await writeFile(
    path.join(root, 'proposal.json'),
    JSON.stringify({
      schemaVersion: 1,
      runId: 'failed-test-run',
      generatedAt: '2026-10-31T12:00:00Z',
      status: 'failed',
      candidates: [],
      additions: [],
      conflicts: [],
      runIssues: [],
      sourceFailures: [{ sourceId: 'fixture', contest: null, message: 'Source unavailable.' }],
    }),
  );
  return root;
};

const writeEligibleProposal = async (root: string) => {
  await writeFile(
    path.join(root, 'config/standings-sources.json'),
    JSON.stringify({
      schemaVersion: 1,
      sources: [
        {
          id: 'fixture',
          authorityId: 'fixture',
          name: 'Fixture',
          baseUrl: 'https://example.com',
          supportedStages: ['qualifier-2'],
          supportsSeasonStanding: false,
        },
      ],
      preferredSources: [{ stage: 'qualifier-2', sourceIds: ['fixture'] }],
      overrides: [],
      preferredSeasonStandingSources: [],
      seasonStandingOverrides: [],
      editionMappings: [{ sourceId: 'fixture', editionLabel: '2024', seasonYear: 2024 }],
    }),
  );
  await writeFile(
    path.join(root, 'config/standings-identities.json'),
    JSON.stringify({
      schemaVersion: 1,
      aliases: [
        {
          entityType: 'team',
          sourceId: 'fixture',
          sourceIdentityId: 'alpha',
          seasonYear: 2024,
          canonicalId: '2024-a',
          reviewedBy: 'reviewer',
          reviewReference: 'review-1',
          reviewedAt: '2026-10-31T12:00:00Z',
        },
      ],
    }),
  );
  await writeFile(
    path.join(root, 'proposal.json'),
    JSON.stringify({
      schemaVersion: 1,
      runId: 'eligible-test-run',
      generatedAt: '2026-10-31T12:00:00Z',
      status: 'complete',
      additions: [],
      conflicts: [],
      runIssues: [],
      sourceFailures: [],
      candidates: [
        {
          candidateId: 'fixture-q2',
          sourceId: 'fixture',
          authorityId: 'fixture',
          discoveryUrl: 'https://example.com/index',
          finalUrl: 'https://example.com/results',
          retrievedAt: '2026-10-31T12:00:00Z',
          contentSha256: 'a'.repeat(64),
          parserVersion: 'fixture-v1',
          promptVersion: null,
          model: null,
          sourceEditionLabel: '2024',
          contest: {
            seasonYear: 2024,
            seriesId: 'gpm',
            stage: 'qualifier-2',
            name: 'Fixture q2',
            publicationState: 'final',
            date: null,
            durationMinutes: null,
            penaltyMinutesPerFailedAttempt: null,
            problemLabels: [],
          },
          rows: [
            {
              place: 1,
              sourceTeamId: 'alpha',
              teamName: 'Alpha',
              sourceSchoolId: null,
              schoolName: null,
              results: null,
              publishedTotals: { solved: 2, penalty: null },
              evidence: [
                {
                  field: 'rows[0].place',
                  kind: 'manual',
                  locator: 'row 1',
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
    }),
  );
};

describe('draft output safety', () => {
  it('writes archive-shaped records only under a fresh ignored draft bundle', async () => {
    const root = await createRoot();
    try {
      await writeEligibleProposal(root);
      const [bundle] = await materializeProposalFiles(['proposal.json'], root);
      const draft = JSON.parse(
        await readFile(path.join(bundle, 'data/seasons/2024/gpm/qualifier-2.json'), 'utf8'),
      ) as { standings: { teamId: string }[] };
      expect(draft.standings[0].teamId).toBe('2024-a');
      await expect(
        readFile(path.join(root, 'data/seasons/2024/gpm/qualifier-2.json'), 'utf8'),
      ).rejects.toThrow();
      expect(
        (
          JSON.parse(await readFile(path.join(bundle, 'report.json'), 'utf8')) as {
            files: unknown[];
          }
        ).files,
      ).toHaveLength(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects a composed dataset with a conflicting existing contest ID before writing drafts', async () => {
    const root = await createRoot();
    try {
      await writeEligibleProposal(root);
      const file = path.join(root, 'data/seasons/2024/gpm/qualifier-1.json');
      const existing = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
      await writeFile(file, JSON.stringify({ ...existing, id: '2024-gpm-qualifier-2' }));
      await expect(materializeProposalFiles(['proposal.json'], root)).rejects.toThrow(
        'Draft dataset did not validate',
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('does not generate a draft over an existing archive filename with a different stage', async () => {
    const root = await createRoot();
    try {
      await writeEligibleProposal(root);
      const content = await readFile(
        path.join(root, 'data/seasons/2024/gpm/qualifier-1.json'),
        'utf8',
      );
      await writeFile(
        path.join(root, 'data/seasons/2024/gpm/qualifier-2.json'),
        JSON.stringify({
          ...(JSON.parse(content) as Record<string, unknown>),
          id: 'other-existing-contest',
        }),
      );
      const [bundle] = await materializeProposalFiles(['proposal.json'], root);
      const report = JSON.parse(await readFile(path.join(bundle, 'report.json'), 'utf8')) as {
        files: unknown[];
        blocked: { reason: string }[];
      };
      expect(report.files).toEqual([]);
      expect(report.blocked[0].reason).toContain('filename already exists');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it('writes fresh diagnostic bundles for blocked proposals without touching the archive', async () => {
    const root = await createRoot();
    try {
      const original = await readFile(path.join(root, 'data/schools.json'), 'utf8');
      const first = await materializeProposalFiles(['proposal.json'], root);
      const second = await materializeProposalFiles(['proposal.json'], root);
      expect(first[0]).not.toBe(second[0]);
      const report = JSON.parse(await readFile(path.join(first[0], 'report.json'), 'utf8')) as {
        files: unknown[];
        warnings: string[];
      };
      expect(report.files).toEqual([]);
      expect(report.warnings).toContain('Source unavailable.');
      expect(await readFile(path.join(root, 'data/schools.json'), 'utf8')).toBe(original);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('refuses a symlink that would redirect draft output into the real archive', async () => {
    const root = await createRoot();
    try {
      await symlink(path.join(root, 'data'), path.join(root, '.standings-ingestion'));
      await expect(materializeProposalFiles(['proposal.json'], root)).rejects.toThrow(
        'symbolic links',
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects missing input files and invalid proposal counts', async () => {
    await expect(materializeProposalFiles([])).rejects.toThrow('Provide between');
    await expect(
      materializeProposalFiles(Array.from({ length: 101 }, () => 'proposal.json')),
    ).rejects.toThrow('Provide between');
    const root = await createRoot();
    try {
      await expect(materializeProposalFiles(['missing.json'], root)).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects oversized proposal inputs and invalid published archives', async () => {
    const root = await createRoot();
    try {
      await truncate(path.join(root, 'proposal.json'), 65 * 1024 * 1024);
      await expect(materializeProposalFiles(['proposal.json'], root)).rejects.toThrow('at most');
      await writeFile(path.join(root, 'data/schools.json'), '{}');
      await expect(materializeProposalFiles(['proposal.json'], root)).rejects.toThrow(
        'Published archive did not validate',
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
