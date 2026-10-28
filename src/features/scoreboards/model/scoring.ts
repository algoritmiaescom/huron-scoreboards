import type { Contest, StandingRow } from './schemas';

export const scoreStandingRow = (
  row: StandingRow,
  penaltyMinutesPerFailedAttempt: number,
): { solved: number; penalty: number } =>
  row.results.reduce(
    (score, result) =>
      result.status === 'solved'
        ? {
            solved: score.solved + 1,
            penalty:
              score.penalty +
              result.solvedAtMinute +
              penaltyMinutesPerFailedAttempt * (result.attempts - 1),
          }
        : score,
    { solved: 0, penalty: 0 },
  );

export const selectFirstSolves = (contest: Contest): ReadonlyMap<string, ReadonlySet<string>> =>
  new Map(
    contest.problems.map((problem, index) => {
      let earliest = Infinity;
      const teams = new Set<string>();
      contest.standings.forEach((row) => {
        const result = row.results[index];
        if (result.status !== 'solved' || result.solvedAtMinute > earliest) {
          return;
        }
        if (result.solvedAtMinute < earliest) {
          earliest = result.solvedAtMinute;
          teams.clear();
        }
        teams.add(row.teamId);
      });
      return [problem.label, teams];
    }),
  );
