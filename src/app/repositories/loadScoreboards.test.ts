// @vitest-environment node
import { createMemoryRouter } from 'react-router';
import { expect, it, vi } from 'vitest';

import { revalidateScoreboards } from './loadScoreboards';

it('revalidates scoreboard data only when the selected season changes', async () => {
  const loader = vi.fn(() => 'loaded');
  const router = createMemoryRouter(
    [{ path: '/scoreboards', loader, shouldRevalidate: revalidateScoreboards }],
    { initialEntries: ['/scoreboards?contest=2024-gpm-qualifier-1'] },
  );
  await vi.waitFor(() => {
    expect(router.state.initialized).toBe(true);
  });
  expect(loader).toHaveBeenCalledOnce();

  await router.navigate('/scoreboards?season=2024&series=gpm&view=accumulated');
  expect(loader).toHaveBeenCalledOnce();

  await router.navigate('/scoreboards?season=2025&series=gpm&view=accumulated');
  expect(loader).toHaveBeenCalledTimes(2);
});
