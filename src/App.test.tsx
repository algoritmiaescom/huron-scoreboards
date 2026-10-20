import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from '@/App';
import { renderApp } from '@/test/test-utils';

describe('App', () => {
  it('shows the under construction screen', () => {
    renderApp(<App />);

    expect(screen.getByRole('heading', { name: 'En construcción' })).toBeInTheDocument();
    expect(
      screen.getByText('Huron Scoreboards esta en construcción. Vuelve pronto :).'),
    ).toBeInTheDocument();
  });
});
