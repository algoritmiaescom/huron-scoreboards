import { randomUUID } from 'node:crypto';
import { link, mkdir, open, unlink } from 'node:fs/promises';
import path from 'node:path';

import { reconcileCandidates } from '@/features/scoreboards/ingestion/reconcile';
import { standingsCandidateSchema } from '@/features/scoreboards/ingestion/schemas';
import { reviewProposalSchema } from '@/features/scoreboards/ingestion/schemas';

import { stableSerialize } from './cache';

import type { ReviewProposal } from '@/features/scoreboards/ingestion/schemas';
import type { ScoreboardsArchive } from '@/features/scoreboards/repositories/scoreboardsRepository';

export interface CandidateSelection {
  sourceId?: string;
  seasonYear?: number;
  seriesId?: string;
  stage?: string;
}

export const selectCandidateInputs = (
  rawCandidates: readonly unknown[],
  selection: CandidateSelection,
): unknown[] =>
  rawCandidates.filter((candidate) => {
    const parsed = standingsCandidateSchema.safeParse(candidate);
    if (!parsed.success) {
      return true;
    }
    return (
      (selection.sourceId === undefined || parsed.data.sourceId === selection.sourceId) &&
      (selection.seasonYear === undefined ||
        parsed.data.contest.seasonYear === selection.seasonYear) &&
      (selection.seriesId === undefined || parsed.data.contest.seriesId === selection.seriesId) &&
      (selection.stage === undefined || parsed.data.contest.stage === selection.stage)
    );
  });

export const createReviewProposal = ({
  archive,
  candidates,
  sourceConfiguration,
  identityAliases,
  selection = {},
  runId,
  generatedAt,
}: {
  archive: ScoreboardsArchive;
  candidates: readonly unknown[];
  sourceConfiguration: unknown;
  identityAliases: readonly unknown[];
  selection?: CandidateSelection;
  runId: string;
  generatedAt: string;
}): ReviewProposal =>
  reviewProposalSchema.parse(
    reconcileCandidates({
      archive,
      candidates: selectCandidateInputs(candidates, selection),
      sourceConfiguration,
      identityAliases,
      runId,
      generatedAt,
    }),
  );

const PROPOSAL_FILENAME = /^[a-z0-9][a-z0-9._-]*\.json$/;

export const writeProposalAtomically = async (
  directory: string,
  fileName: string,
  proposal: ReviewProposal,
): Promise<string> =>
  writeJsonAtomically(directory, fileName, reviewProposalSchema.parse(proposal));

export const writeJsonAtomically = async (
  directory: string,
  fileName: string,
  value: unknown,
): Promise<string> => {
  if (!PROPOSAL_FILENAME.test(fileName) || fileName.includes('..')) {
    throw new TypeError('Output filename must be a simple JSON filename.');
  }
  await mkdir(directory, { recursive: true });
  const destination = path.join(directory, fileName);
  const temporary = path.join(directory, `.${fileName}.${randomUUID()}.tmp`);
  const handle = await open(temporary, 'wx', 0o600);
  try {
    await handle.writeFile(`${stableSerialize(value)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await link(temporary, destination);
  } catch (error) {
    await unlink(temporary);
    throw error;
  }
  await unlink(temporary);
  return destination;
};
