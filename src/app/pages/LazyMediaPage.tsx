import { lazy, Suspense } from 'react';

import { RouteLoading } from '@/app/pages/RouteStatusPages';

const MediaPage = lazy(async () => {
  const page = await import('@/app/pages/MediaPage');
  return { default: page.MediaPage };
});

export const LazyMediaPage = () => (
  <Suspense fallback={<RouteLoading />}>
    <MediaPage />
  </Suspense>
);
