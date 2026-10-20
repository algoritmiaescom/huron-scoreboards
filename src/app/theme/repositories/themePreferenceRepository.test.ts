import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  localStorageThemePreferenceRepository as repository,
  THEME_PREFERENCE_KEY,
} from './themePreferenceRepository';

describe('localStorage theme preference repository', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('distinguishes an absent preference and round-trips both modes', () => {
    expect(repository.read()).toBeUndefined();
    repository.write('dark');
    expect(localStorage.getItem(THEME_PREFERENCE_KEY)).toBe('dark');
    expect(repository.read()).toBe('dark');
    repository.write('light');
    expect(repository.read()).toBe('light');
  });

  it.each(['', 'system', '"dark"', '{"mode":"dark"}'])(
    'rejects invalid stored mode %s',
    (value) => {
      localStorage.setItem(THEME_PREFERENCE_KEY, value);
      expect(() => repository.read()).toThrow();
    },
  );

  it('propagates blocked reads and failed writes to the caller', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage is blocked');
    });
    expect(() => repository.read()).toThrow('Storage is blocked');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });
    expect(() => {
      repository.write('dark');
    }).toThrow('Quota exceeded');
  });
});
