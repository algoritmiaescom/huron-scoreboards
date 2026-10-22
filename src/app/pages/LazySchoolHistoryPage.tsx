import { lazy, Suspense } from 'react';

import { RouteLoading } from '@/app/pages/RouteStatusPages';

const SchoolHistoryPage = lazy(async () => {
  const page = await import('@/app/pages/SchoolHistoryPage');
  return { default: page.SchoolHistoryPage };
});

export const LazySchoolHistoryPage = () => (
  <Suspense fallback={<RouteLoading />}>
    <SchoolHistoryPage />
  </Suspense>
);
