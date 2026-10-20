import { z } from 'zod';

const themeModeSchema = z.enum(['light', 'dark']);

export type ThemeMode = z.infer<typeof themeModeSchema>;

export interface ThemePreferenceRepository {
  read: () => ThemeMode | undefined;
  write: (mode: ThemeMode) => void;
}

export const THEME_PREFERENCE_KEY = 'huron-scoreboards.theme-mode';

export const localStorageThemePreferenceRepository: ThemePreferenceRepository = {
  read: () => {
    const value = window.localStorage.getItem(THEME_PREFERENCE_KEY);
    return value === null ? undefined : themeModeSchema.parse(value);
  },
  write: (mode) => {
    window.localStorage.setItem(THEME_PREFERENCE_KEY, themeModeSchema.parse(mode));
  },
};
