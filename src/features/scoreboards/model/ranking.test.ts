import { describe, expect, it } from 'vitest';

import {
  bestKnownPlace,
  comparePlaces,
  formatPlace,
  isPodiumPlace,
  isValidPlaceRanking,
} from './ranking';

describe('published ranking fidelity', () => {
  it('keeps unknown places after known places without converting them to zero', () => {
    expect([null, 4, 1, null, 2].toSorted(comparePlaces)).toEqual([1, 2, 4, null, null]);
    expect(comparePlaces(null, null)).toBe(0);
    expect(formatPlace(null)).toBe('No publicado');
    expect(formatPlace(undefined)).toBe('No publicado');
    expect(formatPlace(4)).toBe('#4');
  });

  it('excludes unknown places from best-place and podium statistics', () => {
    expect(bestKnownPlace([null, 4, 2])).toBe(2);
    expect(bestKnownPlace([null])).toBeUndefined();
    expect(bestKnownPlace([])).toBeUndefined();
    expect(isPodiumPlace(null)).toBe(false);
    expect(isPodiumPlace(1)).toBe(true);
    expect(isPodiumPlace(4)).toBe(false);
  });

  it('validates dense and competition ranking independently', () => {
    expect(isValidPlaceRanking([1, 2, 2, 4])).toBe(true);
    expect(isValidPlaceRanking([1, 2, 2, 3])).toBe(false);
    expect(isValidPlaceRanking([1, 2, 2, 3], 'dense')).toBe(true);
    expect(isValidPlaceRanking([1, 2, 2, 4], 'dense')).toBe(false);
  });
});
