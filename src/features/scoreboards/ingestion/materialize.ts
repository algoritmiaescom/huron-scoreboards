import { resolveReviewedIdentity } from './identities';
import { reconcileCandidates } from './reconcile';
import { reviewProposalSchema } from './schemas';
import { contestSchema, seasonStandingSchema } from '../model/schemas';

import type { ReviewedIdentityAlias } from './identities';
import type { ReviewProposal, SeasonStandingCandidate, StandingsCandidate } from './schemas';
import type { Contest, SeasonStanding } from '../model/schemas';
import type { ScoreboardsArchive } from '../repositories/scoreboardsRepository';

export interface ArchiveDraft {
  path: string;
  candidateId: string;
  record: Contest | SeasonStanding;
}

export interface MaterializationReport {
  runId: string;
  files: ArchiveDraft[];
  blocked: { candidateId: string; reason: string }[];
  warnings: string[];
}

const draftPath = (candidate: StandingsCandidate | SeasonStandingCandidate): string => {
  const seasonYear = 'contest' in candidate ? candidate.contest.seasonYear : candidate.seasonYear;
  const seriesId = 'contest' in candidate ? candidate.contest.seriesId : candidate.seriesId;
  const fileName = 'contest' in candidate ? candidate.contest.stage : 'standing';
  return `data/seasons/${String(seasonYear)}/${seriesId}/${fileName}.json`;
};

export const materializeProposal = ({
  proposal: rawProposal,
  archive,
  sourceConfiguration,
  identityAliases,
}: {
  proposal: unknown;
  archive: ScoreboardsArchive;
  sourceConfiguration: unknown;
  identityAliases: readonly ReviewedIdentityAlias[];
}): MaterializationReport => {
  const proposal = reviewProposalSchema.parse(rawProposal);
  const report: MaterializationReport = {
    runId: proposal.runId,
    files: [],
    blocked: [],
    warnings: ['Drafts require human source verification and are not written to the archive.'],
  };
  const candidates = [...proposal.candidates, ...proposal.seasonStandingCandidates];
  const block = (candidateId: string, reason: string) => {
    report.blocked.push({ candidateId, reason });
  };
  if (proposal.status === 'failed' || proposal.runIssues.length > 0) {
    candidates.forEach(({ candidateId }) => {
      block(candidateId, 'Saved proposal failed run-level gates.');
    });
    report.warnings.push(...proposal.runIssues.map(({ message }) => message));
    report.warnings.push(...proposal.sourceFailures.map(({ message }) => message));
    return report;
  }
  const reconciled = reconcileCandidates({
    archive,
    candidates: proposal.candidates,
    seasonStandingCandidates: proposal.seasonStandingCandidates,
    sourceConfiguration,
    identityAliases,
    runId: proposal.runId,
    generatedAt: proposal.generatedAt,
  });
  report.warnings.push(...proposal.sourceFailures.map(({ message }) => message));
  report.warnings.push(...reconciled.runIssues.map(({ message }) => message));
  const targetCounts = new Map<string, number>();
  candidates.forEach((candidate) => {
    const target = draftPath(candidate);
    targetCounts.set(target, (targetCounts.get(target) ?? 0) + 1);
  });
  candidates.forEach((candidate) => {
    const isContest = 'contest' in candidate;
    const seasonYear = isContest ? candidate.contest.seasonYear : candidate.seasonYear;
    const seriesId = isContest ? candidate.contest.seriesId : candidate.seriesId;
    const target = draftPath(candidate);
    const existing = isContest
      ? archive.contests.some(
          (contest) =>
            contest.seasonYear === seasonYear &&
            contest.seriesId === seriesId &&
            contest.stage === candidate.contest.stage,
        )
      : archive.seasonStandings.some(
          (standing) => standing.seasonYear === seasonYear && standing.seriesId === seriesId,
        );
    if (existing) {
      block(candidate.candidateId, 'Archive target already exists; submit corrections manually.');
      return;
    }
    if (targetCounts.get(target) !== 1) {
      block(
        candidate.candidateId,
        'Multiple candidates target this record; select one reviewed candidate.',
      );
      return;
    }
    const savedFailures = proposal.sourceFailures.filter(
      (failure) =>
        failure.sourceId === candidate.sourceId &&
        (failure.contest === null ||
          (isContest &&
            failure.contest.seasonYear === seasonYear &&
            failure.contest.seriesId === seriesId &&
            failure.contest.stage === candidate.contest.stage)),
    );
    const conflicts = [
      ...reconciled.conflicts,
      ...reconciled.seasonStandingConflicts,
      ...proposal.conflicts.filter(({ kind }) => kind !== 'identity'),
      ...proposal.seasonStandingConflicts.filter(({ kind }) => kind !== 'identity'),
    ].filter(({ alternatives }) =>
      alternatives.some(({ candidateId }) => candidateId === candidate.candidateId),
    );
    const references: ReviewProposal['additions'] = isContest
      ? reconciled.additions
      : reconciled.seasonStandingAdditions;
    const eligibleRows = new Set(
      references
        .filter(({ candidateId }) => candidateId === candidate.candidateId)
        .map(({ rowIndex }) => rowIndex),
    );
    if (
      savedFailures.length > 0 ||
      conflicts.length > 0 ||
      reconciled.runIssues.length > 0 ||
      candidate.rows.some((_, rowIndex) => !eligibleRows.has(rowIndex))
    ) {
      const issues = [
        ...savedFailures.map(({ message }) => message),
        ...reconciled.sourceFailures
          .filter(({ sourceId }) => sourceId === candidate.sourceId)
          .map(({ message }) => message),
        ...reconciled.runIssues.map(({ message }) => message),
        ...conflicts.map(({ kind, field }) => `${kind}: ${field}`),
      ];
      block(candidate.candidateId, issues.join('; ') || 'Not every row is eligible for addition.');
      return;
    }
    const teamIds = candidate.rows.map((row) => {
      const identity = resolveReviewedIdentity(identityAliases, {
        sourceId: candidate.sourceId,
        entityType: 'team',
        sourceIdentityId: row.sourceTeamId,
        seasonYear,
      });
      return identity.status === 'resolved' ? identity.canonicalId : null;
    });
    if (teamIds.some((teamId) => teamId === null) || new Set(teamIds).size !== teamIds.length) {
      block(candidate.candidateId, 'Team identities must resolve uniquely for every row.');
      return;
    }
    const record = isContest
      ? contestSchema.parse({
          id: `${String(seasonYear)}-${seriesId}-${candidate.contest.stage}`,
          seasonYear,
          seriesId,
          stage: candidate.contest.stage,
          name: candidate.contest.name,
          date: candidate.contest.date,
          durationMinutes: candidate.contest.durationMinutes,
          penaltyMinutesPerFailedAttempt: candidate.contest.penaltyMinutesPerFailedAttempt,
          problems: candidate.contest.problemLabels.map((label) => ({ label })),
          standings: candidate.rows.map((row, rowIndex) => ({
            place: row.place,
            teamId: teamIds[rowIndex],
            results: row.results,
            ...(row.publishedTotals === null ? {} : { publishedTotals: row.publishedTotals }),
          })),
          source: candidate.finalUrl,
        })
      : seasonStandingSchema.parse({
          seasonYear,
          seriesId,
          rows: candidate.rows.map((row, rowIndex) => ({
            place: row.place,
            teamId: teamIds[rowIndex],
            score: row.score,
            qualified: row.qualified,
          })),
          source: candidate.finalUrl,
          scoreUnit: candidate.scoreUnit,
          snapshot: candidate.snapshot,
        });
    report.files.push({ path: target, candidateId: candidate.candidateId, record });
    report.warnings.push(...candidate.warnings);
    if (!isContest) {
      report.warnings.push(
        `${candidate.candidateId}: accumulated score unit is ${candidate.scoreUnit}.`,
      );
    }
  });
  report.files.sort((left, right) => left.path.localeCompare(right.path));
  return report;
};
