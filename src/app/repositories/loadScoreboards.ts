import { mexicoCityDate } from '@/lib/dates';

import { loadApplicationRepositories, scoreboardsCatalog } from './applicationData';

import type { ScoreboardsArchive } from '@/features/scoreboards';
import type { RepositoryResult } from '@/lib/data/repository';
import type { ShouldRevalidateFunction } from 'react-router';

let archiveResult: Promise<RepositoryResult<ScoreboardsArchive>> | undefined;
let repositoriesResult: ReturnType<typeof loadApplicationRepositories> | undefined;

const getRepositories = () => {
  repositoriesResult ??= loadApplicationRepositories().catch((error: unknown) => {
    repositoriesResult = undefined;
    throw error;
  });
  return repositoriesResult;
};

const latestCatalogSeason = (today: string): number | undefined => {
  const latestHeldContest = scoreboardsCatalog.contests
    .filter((contest) => contest.date !== null && contest.date <= today)
    .toSorted((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.id.localeCompare(b.id))
    .at(0);
  const latestContest = scoreboardsCatalog.contests
    .toSorted((a, b) => b.seasonYear - a.seasonYear)
    .at(0);
  return (
    latestHeldContest?.seasonYear ??
    latestContest?.seasonYear ??
    scoreboardsCatalog.seasonStandings.at(0)?.seasonYear
  );
};

export const scoreboardDataSeason = (
  params: URLSearchParams,
  today: string,
): number | undefined => {
  const latest = latestCatalogSeason(today);
  const contestId = params.get('contest');
  if (contestId !== null) {
    return scoreboardsCatalog.contests.find(({ id }) => id === contestId)?.seasonYear ?? latest;
  }

  const season = params.get('season');
  const series = params.get('series');
  if (season !== null && /^\d{4}$/.test(season) && series !== null) {
    const year = Number(season);
    if (
      scoreboardsCatalog.seasonStandings.some(
        (standing) => standing.seasonYear === year && standing.seriesId === series,
      )
    ) {
      return year;
    }
  }
  return latest;
};

export const revalidateScoreboards: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}) => {
  if (currentUrl.pathname !== nextUrl.pathname || currentUrl.search === nextUrl.search) {
    return defaultShouldRevalidate;
  }
  const today = mexicoCityDate(new Date());
  return (
    scoreboardDataSeason(currentUrl.searchParams, today) !==
    scoreboardDataSeason(nextUrl.searchParams, today)
  );
};

export const loadScoreboards = async (args?: { request: Request }) => {
  const repositories = await getRepositories();
  const isScoreboardsRoute =
    args !== undefined && new URL(args.request.url).pathname.endsWith('/scoreboards');
  if (!isScoreboardsRoute) {
    archiveResult ??= repositories.scoreboards.load().catch((error: unknown) => {
      archiveResult = undefined;
      throw error;
    });
    const result = await archiveResult;
    if (result.status === 'invalid' || result.status === 'error') {
      console.error('Could not load scoreboard archive.', result.issues);
    }
    return result;
  }

  const season = scoreboardDataSeason(
    new URL(args.request.url).searchParams,
    mexicoCityDate(new Date()),
  );
  const result =
    season === undefined
      ? await repositories.scoreboards.load()
      : await repositories.scoreboards.loadSeason(season);
  if (result.status === 'invalid' || result.status === 'error') {
    console.error('Could not load scoreboard archive.', result.issues);
  }
  return result;
};
