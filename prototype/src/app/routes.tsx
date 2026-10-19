import { createBrowserRouter, Navigate } from "react-router"
import Layout from "@/components/Layout"

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, element: <Navigate to="/scoreboards" replace /> },
      {
        path: "scoreboards",
        lazy: () =>
          import("@/pages/ScoreboardsPage").then((module) => ({
            Component: module.default,
          })),
      },
      {
        path: "schools",
        lazy: () =>
          import("@/pages/SchoolsPage").then((module) => ({
            Component: module.default,
          })),
      },
      {
        path: "schools/:schoolId",
        lazy: () =>
          import("@/pages/SchoolDetailPage").then((module) => ({
            Component: module.default,
          })),
      },
      {
        path: "media",
        lazy: () =>
          import("@/pages/MediaPage").then((module) => ({
            Component: module.default,
          })),
      },
      {
        path: "contribute",
        lazy: () =>
          import("@/pages/ContributePage").then((module) => ({
            Component: module.default,
          })),
      },
      {
        path: "*",
        lazy: () =>
          import("@/pages/NotFoundPage").then((module) => ({
            Component: module.default,
          })),
      },
    ],
  },
])
