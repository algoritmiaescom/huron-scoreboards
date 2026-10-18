# Huron Scoreboards

A React application for displaying and administering local scoreboards. It currently serves a
single "Under construction" placeholder screen while scoreboard features are built.

## Prerequisites

- Node.js 24
- npm 11

## Getting started

```sh
nvm use
npm ci
npm run dev
```

The initial implementation serves a placeholder screen only. Scoreboard behavior, routing, and
persistence are not implemented yet.

## Commands

| Command                 | Purpose                                           |
| ----------------------- | ------------------------------------------------- |
| `npm run dev`           | Start the Vite development server                 |
| `npm run build`         | Type-check and build the production bundle        |
| `npm run lint`          | Run ESLint with warnings treated as failures      |
| `npm run format`        | Format supported files with Prettier              |
| `npm run test`          | Run unit and component tests                      |
| `npm run test:coverage` | Run tests and enforce coverage thresholds         |
| `npm run test:e2e`      | Run Playwright end-to-end and accessibility tests |
| `npm run validate`      | Run all non-E2E quality checks                    |

## Documentation

- [Architecture](docs/architecture.md)
- [Best practices](docs/best-practices.md)
- [Folder structure](docs/folder-structure.md)
- [Testing](docs/testing.md)
- [Accessibility](docs/accessibility.md)
- [Contributing](CONTRIBUTING.md)

Hosting and deployment are intentionally undecided.
