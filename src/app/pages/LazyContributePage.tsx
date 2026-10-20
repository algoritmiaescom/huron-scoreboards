import { lazy, Suspense } from 'react';

import { RouteLoading } from '@/app/pages/RouteStatusPages';

const ContributePage = lazy(async () => {
  const page = await import('@/app/pages/ContributePage');
  return { default: page.ContributePage };
});

export const LazyContributePage = () => (
  <Suspense fallback={<RouteLoading />}>
    <ContributePage />
  </Suspense>
);
