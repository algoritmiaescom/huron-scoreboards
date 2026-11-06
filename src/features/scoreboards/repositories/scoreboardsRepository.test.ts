import { describe, expect, it, vi } from 'vitest';

import {
  contestCatalogEntrySchema,
  seasonStandingCatalogEntrySchema,
} from '@/features/scoreboards/model/schemas';
import { archiveFiles, contest, jsonFile, standing } from '@/test/fixtures/archive';

import { createJsonScoreboardsRepository } from './scoreboardsRepository';

describe('season-scoped archive loading', () => {
  it('loads one season and the shared school directory while retaining the complete catalog', async () => {
    const files = archiveFiles();
    const otherContest = {
      ...contest,
      id: '2025-gpm-q1',
      seasonYear: 2025,
      standings: [],
    };
    const otherStanding = { ...standing, seasonYear: 2025, rows: [] };
    const schools = vi.fn(files['data/mock/schools.json']);
    const teams2024 = vi.fn(files['data/mock/seasons/2024/teams.json']);
    const contest2024 = vi.fn(files['data/mock/seasons/2024/gpm/qualifier-1.json']);
    const standing2024 = vi.fn(files['data/mock/seasons/2024/gpm/standing.json']);
    const teams2025 = vi.fn(() => Promise.resolve(JSON.stringify([])));
    const contest2025 = vi.fn(jsonFile(otherContest));
    const standing2025 = vi.fn(jsonFile(otherStanding));
    const catalog = {
      contests: [contest, otherContest].map((entry) => contestCatalogEntrySchema.parse(entry)),
      seasonStandings: [standing, otherStanding].map((entry) =>
        seasonStandingCatalogEntrySchema.parse(entry),
      ),
    };
    const repository = createJsonScoreboardsRepository(
      {
        ...files,
        'data/mock/schools.json': schools,
        'data/mock/seasons/2024/teams.json': teams2024,
        'data/mock/seasons/2024/gpm/qualifier-1.json': contest2024,
        'data/mock/seasons/2024/gpm/standing.json': standing2024,
        'data/mock/seasons/2025/teams.json': teams2025,
        'data/mock/seasons/2025/gpm/qualifier-1.json': contest2025,
        'data/mock/seasons/2025/gpm/standing.json': standing2025,
      },
      'mock',
      catalog,
    );

    const result = await repository.loadSeason(2024);
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') {
      throw new Error('Expected the 2024 season to load.');
    }
    expect(result.data.contests.map(({ id }) => id)).toEqual([contest.id]);
    expect(result.data.seasonStandings.map(({ seasonYear }) => seasonYear)).toEqual([2024]);
    expect(result.data.catalog).toEqual(catalog);
    expect(schools).toHaveBeenCalledOnce();
    expect(teams2024).toHaveBeenCalledOnce();
    expect(contest2024).toHaveBeenCalledOnce();
    expect(standing2024).toHaveBeenCalledOnce();
    expect(teams2025).not.toHaveBeenCalled();
    expect(contest2025).not.toHaveBeenCalled();
    expect(standing2025).not.toHaveBeenCalled();

    await repository.loadSeason(2024);
    expect(contest2024).toHaveBeenCalledOnce();
  });
});
