export {
  createJsonScoreboardsRepository,
  type ScoreboardsArchive,
  type ScoreboardsRepository,
} from './repositories/scoreboardsRepository';
export * from './model/selectors';
export { scoreStandingRow, selectFirstSolves } from './model/scoring';
export type {
  Contest,
  ContestStage,
  Problem,
  ProblemResult,
  School,
  SeasonStanding,
  StandingRow,
  Team,
} from './model/schemas';
export {
  candidateCoverageIssues,
  mapSourceEdition,
  reviewProposalSchema,
  selectPreferredSeasonStandingSourceIds,
  selectPreferredSourceIds,
  sourceConfigurationSchema,
  standingsCandidateSchema,
  validateCandidateSource,
} from './ingestion/schemas';
export {
  identityAliasRegistrySchema,
  resolveReviewedIdentity,
  reviewedIdentityAliasSchema,
  validateIdentityAliasTargets,
} from './ingestion/identities';
export { reconcileCandidates } from './ingestion/reconcile';
export type {
  ReviewProposal,
  SourceConfiguration,
  SourceDefinition,
  StandingsCandidate,
} from './ingestion/schemas';
export type { IdentityResolution, ReviewedIdentityAlias } from './ingestion/identities';
export { ContestHeader } from './components/ContestHeader';
export { ProblemResultCell } from './components/ProblemResultCell';
export { ProblemResults } from './components/ProblemResults';
export { ResultsLegend } from './components/ResultsLegend';
export { SchoolIdentity } from './components/SchoolIdentity';
export { SourceCallout } from './components/SourceCallout';
export { TeamIdentity } from './components/TeamIdentity';
export { ScoreboardSelector } from './components/ScoreboardSelector';
export { ContestStandings } from './components/ContestStandings';
export { resolveScoreboardSelection, type ScoreboardSelection } from './model/scoreboardSelection';
