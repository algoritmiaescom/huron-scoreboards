import '@fontsource-variable/space-grotesk';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-700.css';

import { Alert, CssBaseline, type PaletteMode, ThemeProvider } from '@mui/material';
import { type PropsWithChildren, useState } from 'react';

import { createAppTheme } from '@/app/theme/appTheme';
import {
  localStorageThemePreferenceRepository,
  type ThemePreferenceRepository,
} from '@/app/theme/repositories/themePreferenceRepository';
import { ThemeModeContext } from '@/app/theme/ThemeModeContext';

const themes = {
  light: createAppTheme('light'),
  dark: createAppTheme('dark'),
};

interface AppProvidersProps extends PropsWithChildren {
  initialMode?: PaletteMode;
  themePreferenceRepository?: ThemePreferenceRepository;
}

export const AppProviders = ({
  children,
  initialMode,
  themePreferenceRepository = localStorageThemePreferenceRepository,
}: AppProvidersProps) => {
  const [preference, setPreference] = useState<{
    mode: PaletteMode;
    error: string | undefined;
  }>(() => {
    try {
      return {
        mode: initialMode ?? themePreferenceRepository.read() ?? 'light',
        error: undefined,
      };
    } catch (error) {
      console.error('Could not load the theme preference.', error);
      return {
        mode: 'light',
        error: 'Your saved theme could not be loaded. The light theme is being used.',
      };
    }
  });
  const { mode } = preference;
  const toggleMode = () => {
    const nextMode = mode === 'light' ? 'dark' : 'light';
    try {
      themePreferenceRepository.write(nextMode);
      setPreference({ mode: nextMode, error: undefined });
    } catch (error) {
      console.error('Could not save the theme preference.', error);
      setPreference({
        mode: nextMode,
        error: 'Your theme changed for this visit, but the preference could not be saved.',
      });
    }
  };

  return (
    <ThemeModeContext value={{ mode, toggleMode }}>
      <ThemeProvider theme={themes[mode]}>
        <CssBaseline />
        {preference.error && <Alert severity="warning">{preference.error}</Alert>}
        {children}
      </ThemeProvider>
    </ThemeModeContext>
  );
};
