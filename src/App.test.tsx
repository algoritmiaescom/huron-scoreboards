import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from '@/App';
import { renderApp } from '@/test/test-utils';

describe('App', () => {
  it('redirects to the scoreboards route from the app root', async () => {
    renderApp(<App />);

    await screen.findByRole('heading', { name: /GPM|Final Regional/ });
    expect(window.location.pathname).toBe('/scoreboards');
  });
});
