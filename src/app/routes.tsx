import { Navigate } from 'react-router';

import { AppShell } from '@/app/components/AppShell';
import { LazyContributePage } from '@/app/pages/LazyContributePage';
import { LazyScoreboardsPage } from '@/app/pages/LazyScoreboardsPage';
import {
  AppErrorPage,
  NotFoundPage,
  RouteErrorPage,
  RouteLoading,
} from '@/app/pages/RouteStatusPages';
import { loadScoreboards } from '@/app/repositories/loadScoreboards';

import type { RouteObject } from 'react-router';

export const routes: RouteObject[] = [
  {
    Component: AppShell,
    ErrorBoundary: AppErrorPage,
    HydrateFallback: RouteLoading,
    children: [
      { index: true, element: <Navigate to="/scoreboards" replace /> },
      {
        path: 'scoreboards',
        loader: loadScoreboards,
        ErrorBoundary: RouteErrorPage,
        Component: LazyScoreboardsPage,
      },
      {
        path: 'contribute',
        ErrorBoundary: RouteErrorPage,
        Component: LazyContributePage,
      },
      { path: '*', Component: NotFoundPage },
    ],
  },
];
