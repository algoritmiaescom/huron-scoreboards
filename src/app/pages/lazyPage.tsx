import { lazy, Suspense } from 'react';

import { RouteLoading } from '@/app/pages/RouteStatusPages';

import type { ComponentType } from 'react';

/** Wraps a route page in a code-split boundary that shows the shared loading state. */
export const lazyPage = (load: () => Promise<ComponentType>) => {
  const Page = lazy(async () => ({ default: await load() }));
  const LazyPage = () => (
    <Suspense fallback={<RouteLoading />}>
      <Page />
    </Suspense>
  );
  return LazyPage;
};
