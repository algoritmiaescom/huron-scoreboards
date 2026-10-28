import { describe, expect, it } from 'vitest';

import { archive, contest, standing } from '@/test/fixtures/archive';

import {
  accumulatedSelectionParams,
  contestSelectionParams,
  resolveScoreboardSelection,
} from './scoreboardSelection';

describe('accumulated URL selection', () => {
  it('round-trips a separate season standing without adding a contest', () => {
    const params = accumulatedSelectionParams(standing.seasonYear, standing.seriesId);
    expect(params.toString()).toBe('season=2024&series=gpm&view=accumulated');
    expect(
      resolveScoreboardSelection(archive, new URLSearchParams(params.toString()), '2024-01-01'),
    ).toEqual({
      status: 'accumulated',
      standing,
    });
    expect(contestSelectionParams(contest.id).toString()).toBe(`contest=${contest.id}`);
  });

  it.each([
    'season=2024',
    'series=gpm',
    'view=accumulated',
    'season=2024&series=gpm',
    'season=2024&series=&view=accumulated',
    'season=2024&series=gpm&view=contest',
    'season=2024.0&series=gpm&view=accumulated',
    'season=2e3&series=gpm&view=accumulated',
    'season=2024x&series=gpm&view=accumulated',
    'season=&series=gpm&view=accumulated',
    'season=2023&series=gpm&view=accumulated',
    'season=2024&series=missing&view=accumulated',
    'season=2024&series=gpm&view=accumulated&contest=2024-gpm-q1',
    'season=2024&season=2024&series=gpm&view=accumulated',
    'season=2024&series=gpm&series=gpm&view=accumulated',
    'season=2024&series=gpm&view=accumulated&view=accumulated',
    'season=2024&series=gpm&view=accumulated&unknown=1',
  ])('explains invalid selection without substituting another record: %s', (query) => {
    const result = resolveScoreboardSelection(archive, new URLSearchParams(query), '2026-10-20');
    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') {
      expect(result.message.length).toBeGreaterThan(0);
    }
  });

  it('resolves standing-only and open-ended series without requiring a held contest', () => {
    const other = { ...standing, seriesId: 'open-series' };
    const data = { ...archive, contests: [], seasonStandings: [other] };
    expect(
      resolveScoreboardSelection(
        data,
        accumulatedSelectionParams(2024, 'open-series'),
        '2020-01-01',
      ),
    ).toEqual({
      status: 'accumulated',
      standing: other,
    });
    expect(resolveScoreboardSelection(data, new URLSearchParams(), '2026-10-20')).toEqual({
      status: 'empty',
    });
  });

  it('keeps incompatible filters explicit for the accumulated UI to remove', () => {
    const params = accumulatedSelectionParams(2024, 'gpm');
    params.append('problem', 'A');
    params.append('problem', 'B');
    expect(resolveScoreboardSelection(archive, params, '2026-10-20')).toEqual({
      status: 'accumulated',
      standing,
    });
  });
});
