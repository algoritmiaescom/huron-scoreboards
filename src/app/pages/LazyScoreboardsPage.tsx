import { lazy, Suspense } from 'react';

import { RouteLoading } from '@/app/pages/RouteStatusPages';

const ScoreboardsPage = lazy(async () => {
  const page = await import('@/app/pages/ScoreboardsPage');
  return { default: page.ScoreboardsPage };
});

export const LazyScoreboardsPage = () => (
  <Suspense fallback={<RouteLoading />}>
    <ScoreboardsPage />
  </Suspense>
);
