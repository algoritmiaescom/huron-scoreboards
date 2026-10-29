import {
  identityAliasRegistrySchema,
  resolveReviewedIdentity,
  validateIdentityAliasTargets,
} from './identities';
import {
  candidateCoverageIssues,
  reviewProposalSchema,
  sourceConfigurationSchema,
  standingsCandidateSchema,
  validateCandidateSource,
} from './schemas';
import { scoreStandingRow } from '../model/scoring';

import type { CandidateEvidence, ReviewProposal, StandingsCandidate } from './schemas';
import type { Contest } from '../model/schemas';
import type { ScoreboardsArchive } from '../repositories/scoreboardsRepository';

interface ReconcileCandidatesInput {
  archive: ScoreboardsArchive;
  candidates: readonly unknown[];
  sourceConfiguration: unknown;
  identityAliases: readonly unknown[];
  runId: string;
  generatedAt: string;
}

const serializeValue = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
};

const contestKey = (contest: Pick<Contest, 'seasonYear' | 'seriesId' | 'stage'>) => ({
  seasonYear: contest.seasonYear,
  seriesId: contest.seriesId,
  stage: contest.stage,
});

const sameContestKey = (
  left: Pick<Contest, 'seasonYear' | 'seriesId' | 'stage'>,
  right: Pick<StandingsCandidate['contest'], 'seasonYear' | 'seriesId' | 'stage'>,
): boolean =>
  left.seasonYear === right.seasonYear &&
  left.seriesId === right.seriesId &&
  left.stage === right.stage;

const sourceIdFromUnknown = (value: unknown): string => {
  if (
    typeof value === 'object' &&
    value !== null &&
    'sourceId' in value &&
    typeof value.sourceId === 'string' &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.sourceId)
  ) {
    return value.sourceId;
  }
  return 'unknown-source';
};

const rowEvidence = (row: StandingsCandidate['rows'][number], field: string): CandidateEvidence[] =>
  row.evidence.filter(({ field: evidenceField }) => evidenceField === field);

export const reconcileCandidates = ({
  archive,
  candidates: rawCandidates,
  sourceConfiguration,
  identityAliases,
  runId,
  generatedAt,
}: ReconcileCandidatesInput): ReviewProposal => {
  const runIssues: ReviewProposal['runIssues'] = [];
  const sourceFailures: ReviewProposal['sourceFailures'] = [];
  const conflicts: ReviewProposal['conflicts'] = [];
  const additions: ReviewProposal['additions'] = [];

  const parsedConfiguration = sourceConfigurationSchema.safeParse(sourceConfiguration);
  if (!parsedConfiguration.success) {
    runIssues.push({ kind: 'configuration', message: parsedConfiguration.error.message });
    return reviewProposalSchema.parse({
      schemaVersion: 1,
      runId,
      generatedAt,
      status: 'failed',
      candidates: [],
      additions: [],
      conflicts: [],
      runIssues,
      sourceFailures: [],
    });
  }
  const sourceConfig = parsedConfiguration.data;

  const parsedAliases = identityAliasRegistrySchema.safeParse({
    schemaVersion: 1,
    aliases: identityAliases,
  });
  const aliasTargets = parsedAliases.success
    ? validateIdentityAliasTargets(parsedAliases.data.aliases, {
        sourceIds: new Set(sourceConfig.sources.map(({ id }) => id)),
        schoolIds: new Set(archive.schools.map(({ id }) => id)),
        teams: archive.teams,
      })
    : [parsedAliases.error.message];
  if (aliasTargets.length > 0) {
    runIssues.push(
      ...aliasTargets.map((message) => ({ kind: 'identity-registry' as const, message })),
    );
  }
  const usableAliases =
    aliasTargets.length === 0 && parsedAliases.success ? parsedAliases.data.aliases : [];

  const candidates: StandingsCandidate[] = [];
  const seenCandidateIds = new Set<string>();
  rawCandidates.forEach((rawCandidate) => {
    const parsedCandidate = standingsCandidateSchema.safeParse(rawCandidate);
    if (!parsedCandidate.success) {
      sourceFailures.push({
        sourceId: sourceIdFromUnknown(rawCandidate),
        contest: null,
        message: `candidate validation failed: ${parsedCandidate.error.message}`,
      });
      return;
    }
    if (seenCandidateIds.has(parsedCandidate.data.candidateId)) {
      runIssues.push({
        kind: 'candidate',
        message: `duplicate candidate id \`${parsedCandidate.data.candidateId}\``,
      });
      return;
    }
    seenCandidateIds.add(parsedCandidate.data.candidateId);
    candidates.push(parsedCandidate.data);
  });
  candidates.sort((left, right) => left.candidateId.localeCompare(right.candidateId));

  const candidateFailures = new Set<string>();
  const incompleteCandidates = new Set<string>();
  candidates.forEach((candidate) => {
    const issues = validateCandidateSource(candidate, sourceConfig);
    if (issues.length > 0) {
      candidateFailures.add(candidate.candidateId);
      issues.forEach((message) => {
        sourceFailures.push({ sourceId: candidate.sourceId, contest: candidate.contest, message });
      });
    }
    candidateCoverageIssues(candidate).forEach((message) => {
      incompleteCandidates.add(candidate.candidateId);
      sourceFailures.push({
        sourceId: candidate.sourceId,
        contest: candidate.contest,
        message,
      });
    });
  });

  const addConflict = (
    candidate: StandingsCandidate,
    rowIndex: number,
    entityId: string,
    field: string,
    kind: ReviewProposal['conflicts'][number]['kind'],
    currentValue: unknown,
    candidateValue: unknown,
    evidence: CandidateEvidence[],
  ) => {
    conflicts.push({
      contest: contestKey(candidate.contest),
      entityId,
      field,
      kind,
      currentValue: serializeValue(currentValue),
      alternatives: [
        {
          candidateId: candidate.candidateId,
          value: serializeValue(candidateValue),
          evidence:
            evidence.length > 0
              ? evidence
              : (candidate.rows[rowIndex]?.evidence ??
                candidate.rows.flatMap(({ evidence: rowEvidenceItems }) => rowEvidenceItems)),
        },
      ],
    });
  };

  candidates.forEach((candidate) => {
    if (candidateFailures.has(candidate.candidateId)) {
      return;
    }
    const matchingContests = archive.contests.filter((contest) =>
      sameContestKey(contest, candidate.contest),
    );
    if (matchingContests.length > 1) {
      sourceFailures.push({
        sourceId: candidate.sourceId,
        contest: candidate.contest,
        message: 'multiple archive contests match this season, series, and stage',
      });
      return;
    }
    const existingContest = matchingContests.at(0);
    let contestConflict = false;

    if (candidate.contest.publicationState !== 'final') {
      contestConflict = true;
      addConflict(
        candidate,
        0,
        `${String(candidate.contest.seasonYear)}-${candidate.contest.seriesId}-${candidate.contest.stage}`,
        'publicationState',
        'publication-state',
        existingContest === undefined ? null : 'archived record retained',
        candidate.contest.publicationState,
        candidate.rows.flatMap(({ evidence }) => evidence),
      );
    }

    if (existingContest !== undefined) {
      const metadataFields = [
        ['name', existingContest.name, candidate.contest.name],
        ['date', existingContest.date, candidate.contest.date],
        ['durationMinutes', existingContest.durationMinutes, candidate.contest.durationMinutes],
        [
          'penaltyMinutesPerFailedAttempt',
          existingContest.penaltyMinutesPerFailedAttempt,
          candidate.contest.penaltyMinutesPerFailedAttempt,
        ],
      ] as const;
      metadataFields.forEach(([field, currentValue, proposedValue]) => {
        if (proposedValue !== null && currentValue !== proposedValue) {
          contestConflict = true;
          addConflict(
            candidate,
            0,
            existingContest.id,
            `contest.${field}`,
            'archive',
            currentValue,
            proposedValue,
            candidate.rows.flatMap(({ evidence }) => evidence),
          );
        }
      });
      const archivedLabels = existingContest.problems.map(({ label }) => label);
      if (
        candidate.contest.problemLabels.length > 0 &&
        JSON.stringify(archivedLabels) !== JSON.stringify(candidate.contest.problemLabels)
      ) {
        contestConflict = true;
        addConflict(
          candidate,
          0,
          existingContest.id,
          'contest.problemLabels',
          'archive',
          archivedLabels,
          candidate.contest.problemLabels,
          candidate.rows.flatMap(({ evidence }) => evidence),
        );
      }
    }

    candidate.rows.forEach((row, rowIndex) => {
      const teamIdentity = resolveReviewedIdentity(usableAliases, {
        sourceId: candidate.sourceId,
        entityType: 'team',
        sourceIdentityId: row.sourceTeamId,
        seasonYear: candidate.contest.seasonYear,
      });
      if (teamIdentity.status !== 'resolved') {
        addConflict(
          candidate,
          rowIndex,
          row.sourceTeamId ?? `${candidate.candidateId}:row-${String(rowIndex)}`,
          'teamId',
          'identity',
          null,
          row.teamName,
          rowEvidence(row, `rows[${String(rowIndex)}].teamName`),
        );
        return;
      }
      const team = archive.teams.find(
        (entry) =>
          entry.id === teamIdentity.canonicalId &&
          entry.seasonYear === candidate.contest.seasonYear,
      );
      if (team === undefined) {
        addConflict(
          candidate,
          rowIndex,
          teamIdentity.canonicalId,
          'teamId',
          'identity',
          null,
          row.teamName,
          rowEvidence(row, `rows[${String(rowIndex)}].teamName`),
        );
        return;
      }
      if (row.sourceSchoolId !== null) {
        const schoolIdentity = resolveReviewedIdentity(usableAliases, {
          sourceId: candidate.sourceId,
          entityType: 'school',
          sourceIdentityId: row.sourceSchoolId,
          seasonYear: null,
        });
        if (schoolIdentity.status !== 'resolved') {
          addConflict(
            candidate,
            rowIndex,
            team.id,
            'schoolId',
            'identity',
            team.schoolId,
            row.schoolName,
            rowEvidence(row, `rows[${String(rowIndex)}].schoolName`),
          );
          return;
        }
        if (schoolIdentity.canonicalId !== team.schoolId) {
          addConflict(
            candidate,
            rowIndex,
            team.id,
            'schoolId',
            'identity',
            team.schoolId,
            schoolIdentity.canonicalId,
            rowEvidence(row, `rows[${String(rowIndex)}].sourceSchoolId`),
          );
          return;
        }
      }

      if (existingContest === undefined) {
        if (
          candidate.contest.publicationState === 'final' &&
          !incompleteCandidates.has(candidate.candidateId) &&
          !contestConflict &&
          runIssues.length === 0
        ) {
          additions.push({ candidateId: candidate.candidateId, rowIndex });
        }
        return;
      }
      const archivedRow = existingContest.standings.find(({ teamId }) => teamId === team.id);
      if (archivedRow === undefined) {
        if (
          candidate.contest.publicationState === 'final' &&
          !incompleteCandidates.has(candidate.candidateId) &&
          !contestConflict &&
          runIssues.length === 0
        ) {
          additions.push({ candidateId: candidate.candidateId, rowIndex });
        }
        return;
      }
      if (archivedRow.place !== row.place) {
        addConflict(
          candidate,
          rowIndex,
          team.id,
          'place',
          'archive',
          archivedRow.place,
          row.place,
          rowEvidence(row, `rows[${String(rowIndex)}].place`),
        );
      }

      const archivedScore = scoreStandingRow(
        archivedRow,
        existingContest.penaltyMinutesPerFailedAttempt,
      );
      if (row.publishedTotals !== null) {
        if (archivedScore.solved !== row.publishedTotals.solved) {
          addConflict(
            candidate,
            rowIndex,
            team.id,
            'publishedTotals.solved',
            'archive',
            archivedScore.solved,
            row.publishedTotals.solved,
            rowEvidence(row, `rows[${String(rowIndex)}].publishedTotals.solved`),
          );
        }
        if (
          archivedScore.penalty !== null &&
          row.publishedTotals.penalty !== null &&
          archivedScore.penalty !== row.publishedTotals.penalty
        ) {
          addConflict(
            candidate,
            rowIndex,
            team.id,
            'publishedTotals.penalty',
            'archive',
            archivedScore.penalty,
            row.publishedTotals.penalty,
            rowEvidence(row, `rows[${String(rowIndex)}].publishedTotals.penalty`),
          );
        }
      }
      if (row.results === null) {
        return;
      }
      if (archivedRow.results === null) {
        addConflict(
          candidate,
          rowIndex,
          team.id,
          'results',
          'archive',
          null,
          row.results,
          rowEvidence(row, `rows[${String(rowIndex)}].results`),
        );
        return;
      }
      const archivedLabels = existingContest.problems.map(({ label }) => label);
      if (JSON.stringify(archivedLabels) !== JSON.stringify(candidate.contest.problemLabels)) {
        return;
      }
      row.results.forEach((result, problemIndex) => {
        if (JSON.stringify(result) !== JSON.stringify(archivedRow.results[problemIndex])) {
          const label = candidate.contest.problemLabels[problemIndex];
          addConflict(
            candidate,
            rowIndex,
            team.id,
            `results.${label}`,
            'archive',
            archivedRow.results[problemIndex],
            result,
            rowEvidence(row, `rows[${String(rowIndex)}].results.${label}`),
          );
        }
      });
    });
  });

  const status =
    candidates.length === 0
      ? 'failed'
      : sourceFailures.length > 0 || runIssues.length > 0
        ? 'partial'
        : 'complete';
  const proposal = {
    schemaVersion: 1,
    runId,
    generatedAt,
    status,
    candidates,
    additions: runIssues.length > 0 ? [] : additions,
    conflicts,
    runIssues,
    sourceFailures,
  };
  return reviewProposalSchema.parse(proposal);
};
