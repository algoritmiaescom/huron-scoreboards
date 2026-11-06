import { Navigate } from 'react-router';

import { AppShell } from '@/app/components/AppShell';
import { lazyPage } from '@/app/pages/lazyPage';
import {
  AppErrorPage,
  NotFoundPage,
  RouteErrorPage,
  RouteLoading,
} from '@/app/pages/RouteStatusPages';
import { loadMediaPage } from '@/app/repositories/loadMediaPage';
import { loadScoreboards, revalidateScoreboards } from '@/app/repositories/loadScoreboards';

import type { RouteObject, ShouldRevalidateFunction } from 'react-router';

const revalidateArchive: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}) =>
  currentUrl.pathname === nextUrl.pathname && currentUrl.search !== nextUrl.search
    ? false
    : defaultShouldRevalidate;

const ScoreboardsPage = lazyPage(
  async () => (await import('@/app/pages/ScoreboardsPage')).ScoreboardsPage,
);
const SchoolHistoryPage = lazyPage(
  async () => (await import('@/app/pages/SchoolHistoryPage')).SchoolHistoryPage,
);
const SchoolsPage = lazyPage(async () => (await import('@/app/pages/SchoolsPage')).SchoolsPage);
const MediaPage = lazyPage(async () => (await import('@/app/pages/MediaPage')).MediaPage);
const ContributePage = lazyPage(
  async () => (await import('@/app/pages/ContributePage')).ContributePage,
);

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
        shouldRevalidate: revalidateScoreboards,
        ErrorBoundary: RouteErrorPage,
        Component: ScoreboardsPage,
      },
      {
        path: 'schools/:schoolId',
        loader: loadScoreboards,
        shouldRevalidate: revalidateArchive,
        ErrorBoundary: RouteErrorPage,
        Component: SchoolHistoryPage,
      },
      {
        path: 'schools',
        loader: loadScoreboards,
        shouldRevalidate: revalidateArchive,
        ErrorBoundary: RouteErrorPage,
        Component: SchoolsPage,
      },
      {
        path: 'media',
        loader: loadMediaPage,
        ErrorBoundary: RouteErrorPage,
        Component: MediaPage,
      },
      {
        path: 'contribute',
        ErrorBoundary: RouteErrorPage,
        Component: ContributePage,
      },
      { path: '*', Component: NotFoundPage },
    ],
  },
];
