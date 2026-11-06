import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { App } from '@/App';
import { archive } from '@/test/fixtures/archive';
import { renderApp } from '@/test/test-utils';

vi.mock('@/app/repositories/loadScoreboards', () => ({
  loadScoreboards: () => Promise.resolve({ status: 'ready', data: archive }),
  revalidateScoreboards: () => false,
}));

describe('App', () => {
  it('redirects to the scoreboards route from the app root', async () => {
    renderApp(<App />);

    await screen.findByRole('heading', { name: 'Contest' }, { timeout: 5000 });
    expect(window.location.hash.split('?')[0]).toBe('#/scoreboards');
  });
});
