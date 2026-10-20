import type { PaletteMode } from '@mui/material';
import { createContext, useContext } from 'react';

interface ThemeModeControls {
  mode: PaletteMode;
  toggleMode: () => void;
}

export const ThemeModeContext = createContext<ThemeModeControls | undefined>(undefined);

export const useThemeMode = (): ThemeModeControls => {
  const controls = useContext(ThemeModeContext);

  if (controls === undefined) {
    throw new Error('useThemeMode must be used within AppProviders.');
  }

  return controls;
};
