import { lazy, Suspense } from 'react';

import { RouteLoading } from '@/app/pages/RouteStatusPages';

const SchoolsPage = lazy(async () => {
  const page = await import('@/app/pages/SchoolsPage');
  return { default: page.SchoolsPage };
});

export const LazySchoolsPage = () => (
  <Suspense fallback={<RouteLoading />}>
    <SchoolsPage />
  </Suspense>
);
