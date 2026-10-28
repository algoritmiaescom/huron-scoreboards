import { getContrastRatio } from '@mui/material/styles';
import { describe, expect, it } from 'vitest';

import { createAppTheme } from './appTheme';

describe.each(['light', 'dark'] as const)('%s theme', (mode) => {
  const theme = createAppTheme(mode);

  it('preserves the brand, type, spacing, and shape decisions', () => {
    expect(theme.palette.mode).toBe(mode);
    expect(theme.palette.brand.navy).toBe('#183F5D');
    expect(theme.palette.brand.yellow).toBe('#F7B91B');
    expect(theme.typography.fontFamily).toContain('Space Grotesk');
    expect(theme.typography.data.fontFamily).toContain('IBM Plex Mono');
    expect(theme.spacing(2)).toBe('16px');
    expect(theme.shape.borderRadius).toBe(16);
    expect(theme.components?.MuiButton?.defaultProps?.disableElevation).toBe(true);
    expect(theme.components?.MuiCard?.defaultProps?.variant).toBe('outlined');
  });

  it('keeps readable text on brand surfaces and every problem status', () => {
    const { primary, secondary, text, background, scoreboard } = theme.palette;
    const pairs = [
      [primary.main, primary.contrastText],
      [secondary.main, secondary.contrastText],
      [text.primary, background.default],
      [text.secondary, background.paper],
      [text.secondary, scoreboard.unattempted],
      [scoreboard.attemptedText, scoreboard.attempted],
      [scoreboard.solvedText, scoreboard.solved],
      [scoreboard.firstSolveText, scoreboard.firstSolve],
      [text.primary, scoreboard.qualified],
    ];

    pairs.forEach(([foreground, surface]) => {
      expect(getContrastRatio(foreground, surface)).toBeGreaterThanOrEqual(4.5);
    });
  });
});
