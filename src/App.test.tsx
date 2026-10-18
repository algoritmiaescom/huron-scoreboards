import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from '@/App';
import { renderApp } from '@/test/test-utils';

describe('App', () => {
  it('shows the under construction screen', () => {
    renderApp(<App />);

    expect(screen.getByRole('heading', { name: 'Under construction' })).toBeInTheDocument();
    expect(
      screen.getByText('Huron Scoreboards is being built. Check back soon.'),
    ).toBeInTheDocument();
  });
});
