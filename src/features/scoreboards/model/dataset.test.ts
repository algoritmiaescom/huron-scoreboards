import { describe, expect, it } from 'vitest';

import { type ScoreboardsDataset, validateScoreboardsReferences } from './dataset';

const dataset: ScoreboardsDataset = {
  schools: [
    {
      file: 'data/schools.json',
      record: [
        {
          id: 'ipn',
          officialName: 'Instituto Politécnico Nacional',
          shortName: 'IPN',
          parentInstitutionId: 'ipn-escom',
        },
        {
          id: 'ipn-escom',
          officialName: 'Escuela Superior de Cómputo',
          shortName: 'ESCOM',
          parentInstitutionId: 'ipn',
        },
      ],
    },
    {
      file: 'data/schools-extra.json',
      record: [
        {
          id: 'ipn-escom',
          officialName: 'Duplicate School',
          shortName: 'DUP',
        },
      ],
    },
  ],
  teams: [
    {
      file: 'data/seasons/2024/teams.json',
      record: [
        {
          id: '2024-team-a',
          name: 'Team A',
          schoolId: 'ipn-escom',
          seasonYear: 2024,
        },
        {
          id: '2024-team-a',
          name: 'Duplicate Team A',
          schoolId: 'missing-school',
          seasonYear: 2024,
        },
      ],
    },
    {
      file: 'data/seasons/2023/teams.json',
      record: [
        {
          id: '2023-team-a',
          name: 'Team Old',
          schoolId: 'ipn',
          seasonYear: 2023,
        },
      ],
    },
  ],
  contests: [
    {
      file: 'data/seasons/2024/gpm/qualifier-1.json',
      location: { seasonYear: 2024, seriesId: 'gpm' },
      record: {
        id: '2024-gpm-q1',
        seasonYear: 2025,
        seriesId: 'wrong-series',
        stage: 'qualifier-1',
        name: 'Contest',
        date: '2024-03-01',
        durationMinutes: 300,
        penaltyMinutesPerFailedAttempt: 20,
        problems: [{ label: 'A' }],
        standings: [
          {
            place: 2,
            teamId: 'missing-team',
            results: [{ status: 'solved', attempts: 1, solvedAtMinute: 18 }],
          },
        ],
        source: 'https://example.com/contest',
      },
    },
  ],
  seasonStandings: [
    {
      file: 'data/seasons/2024/gpm/standing.json',
      location: { seasonYear: 2024, seriesId: 'gpm' },
      record: {
        seasonYear: 2025,
        seriesId: 'wrong-series',
        rows: [
          {
            place: 2,
            teamId: '2023-team-a',
            score: 1,
            qualified: false,
          },
        ],
        source: 'https://example.com/standing',
      },
    },
  ],
};

describe('validateScoreboardsReferences', () => {
  it('reports cross-file problems', () => {
    expect(validateScoreboardsReferences(dataset)).toEqual(
      expect.arrayContaining([
        {
          file: 'data/schools-extra.json',
          location: '[0].id',
          message: 'duplicate school id `ipn-escom`, already defined in data/schools.json',
        },
        {
          file: 'data/schools.json',
          location: '[1].parentInstitutionId',
          message: 'parent institution of `ipn-escom` forms a cycle',
        },
        {
          file: 'data/seasons/2024/teams.json',
          location: '[1].id',
          message:
            'duplicate team id `2024-team-a`, already defined in data/seasons/2024/teams.json',
        },
        {
          file: 'data/seasons/2024/teams.json',
          location: '[1].schoolId',
          message: 'unknown school `missing-school`',
        },
        {
          file: 'data/seasons/2024/gpm/qualifier-1.json',
          location: 'seasonYear',
          message: 'season 2025 does not match the season 2024 in the file path',
        },
        {
          file: 'data/seasons/2024/gpm/qualifier-1.json',
          location: 'seriesId',
          message: 'series `wrong-series` does not match the series `gpm` in the file path',
        },
        {
          file: 'data/seasons/2024/gpm/qualifier-1.json',
          location: 'standings[0].teamId',
          message: 'unknown team `missing-team`',
        },
        {
          file: 'data/seasons/2024/gpm/standing.json',
          location: 'seasonYear',
          message: 'season 2025 does not match the season 2024 in the file path',
        },
        {
          file: 'data/seasons/2024/gpm/standing.json',
          location: 'seriesId',
          message: 'series `wrong-series` does not match the series `gpm` in the file path',
        },
        {
          file: 'data/seasons/2024/gpm/standing.json',
          location: 'rows[0].teamId',
          message: 'team `2023-team-a` is registered for season 2023, not 2025',
        },
      ]),
    );
  });
});
