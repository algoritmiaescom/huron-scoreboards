import { AppShell } from '@/app/components/AppShell';
import { LazyContributePage } from '@/app/pages/LazyContributePage';
import {
  AppErrorPage,
  NotFoundPage,
  RouteErrorPage,
  RouteLoading,
} from '@/app/pages/RouteStatusPages';
import { UnderConstructionPage } from '@/app/pages/UnderConstructionPage';

import type { RouteObject } from 'react-router';

export const routes: RouteObject[] = [
  {
    Component: AppShell,
    ErrorBoundary: AppErrorPage,
    HydrateFallback: RouteLoading,
    children: [
      { index: true, Component: UnderConstructionPage },
      {
        path: 'contribute',
        ErrorBoundary: RouteErrorPage,
        Component: LazyContributePage,
      },
      { path: '*', Component: NotFoundPage },
    ],
  },
];
