import { Navigate } from 'react-router';

import { AppShell } from '@/app/components/AppShell';
import { LazyContributePage } from '@/app/pages/LazyContributePage';
import { LazySchoolHistoryPage } from '@/app/pages/LazySchoolHistoryPage';
import { LazySchoolsPage } from '@/app/pages/LazySchoolsPage';
import { LazyScoreboardsPage } from '@/app/pages/LazyScoreboardsPage';
import {
  AppErrorPage,
  NotFoundPage,
  RouteErrorPage,
  RouteLoading,
} from '@/app/pages/RouteStatusPages';
import { loadScoreboards } from '@/app/repositories/loadScoreboards';

import type { RouteObject, ShouldRevalidateFunction } from 'react-router';

const revalidateArchive: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}) =>
  currentUrl.pathname === nextUrl.pathname && currentUrl.search !== nextUrl.search
    ? false
    : defaultShouldRevalidate;

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
        shouldRevalidate: revalidateArchive,
        ErrorBoundary: RouteErrorPage,
        Component: LazyScoreboardsPage,
      },
      {
        path: 'schools/:schoolId',
        loader: loadScoreboards,
        shouldRevalidate: revalidateArchive,
        ErrorBoundary: RouteErrorPage,
        Component: LazySchoolHistoryPage,
      },
      {
        path: 'schools',
        loader: loadScoreboards,
        shouldRevalidate: revalidateArchive,
        ErrorBoundary: RouteErrorPage,
        Component: LazySchoolsPage,
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
