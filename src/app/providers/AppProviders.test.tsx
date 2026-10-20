import { Button, Typography, useTheme } from '@mui/material';
import { render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useThemeMode } from '@/app/theme/ThemeModeContext';
import { THEME_PREFERENCE_KEY } from '@/app/theme/repositories/themePreferenceRepository';

import { AppProviders } from './AppProviders';

const ThemeProbe = () => {
  const { mode, toggleMode } = useThemeMode();
  const theme = useTheme();

  return (
    <>
      <Typography variant="data">{`${mode}: ${theme.palette.background.default}`}</Typography>
      <Button onClick={toggleMode}>Toggle theme</Button>
    </>
  );
};

describe('AppProviders', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('starts in light mode and saves both mode changes', async () => {
    const user = userEvent.setup();
    render(
      <AppProviders>
        <ThemeProbe />
      </AppProviders>,
    );

    expect(screen.getByText('light: #F5F4EF').tagName).toBe('SPAN');
    await user.click(screen.getByRole('button', { name: 'Toggle theme' }));
    expect(screen.getByText('dark: #071823')).toBeInTheDocument();
    expect(localStorage.getItem(THEME_PREFERENCE_KEY)).toBe('dark');
    await user.click(screen.getByRole('button', { name: 'Toggle theme' }));
    expect(screen.getByText('light: #F5F4EF')).toBeInTheDocument();
    expect(localStorage.getItem(THEME_PREFERENCE_KEY)).toBe('light');
  });

  it('supports an explicit initial dark theme without browser storage', () => {
    render(
      <AppProviders initialMode="dark">
        <ThemeProbe />
      </AppProviders>,
    );

    expect(screen.getByText('dark: #071823')).toBeInTheDocument();
  });

  it('restores the saved preference when the provider remounts', async () => {
    const user = userEvent.setup();
    const first = render(
      <AppProviders>
        <ThemeProbe />
      </AppProviders>,
    );
    await user.click(screen.getByRole('button', { name: 'Toggle theme' }));
    first.unmount();
    render(
      <AppProviders>
        <ThemeProbe />
      </AppProviders>,
    );
    expect(screen.getByText('dark: #071823')).toBeInTheDocument();
  });

  it('reports invalid preferences and repairs them on the next successful change', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    localStorage.setItem(THEME_PREFERENCE_KEY, 'invalid');
    render(
      <AppProviders>
        <ThemeProbe />
      </AppProviders>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('could not be loaded');
    expect(screen.getByText('light: #F5F4EF')).toBeInTheDocument();
    expect(log).toHaveBeenCalledWith('Could not load the theme preference.', expect.any(Error));
    await userEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(localStorage.getItem(THEME_PREFERENCE_KEY)).toBe('dark');
  });

  it('keeps the mode usable and warns when storage is unavailable', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const read = vi.fn(() => {
      throw new Error('Blocked');
    });
    const write = vi.fn(() => {
      throw new Error('Blocked');
    });
    render(
      <AppProviders themePreferenceRepository={{ read, write }}>
        <ThemeProbe />
      </AppProviders>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('could not be loaded');
    await userEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));
    expect(screen.getByText('dark: #071823')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('could not be saved');
    expect(log).toHaveBeenCalledWith('Could not save the theme preference.', expect.any(Error));
  });

  it('reports missing provider composition instead of returning a no-op control', () => {
    expect(() => renderHook(useThemeMode)).toThrow(
      'useThemeMode must be used within AppProviders.',
    );
  });
});
