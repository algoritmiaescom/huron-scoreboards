# Huron Scoreboards

The public site of the algorithms club at Huron. Its goal is to publish the historical standings
of Mexican ICPC programming competitions, surface the community reaction around the latest
contest, and let anyone correct the record through this repository.

Planned modules:

- **Scoreboards** — contest standings with per-problem attempts, accepted times, and
  first-to-solve highlights, plus filters and per-school historical pages.
- **Media feed** — public posts published under the hashtag of the most recent contest.
- **Contribution** — a guide for adding and correcting competition data through GitHub.

See [Product scope](docs/product-scope.md) for the full definition. The application currently
serves a single "Under construction" placeholder screen while these features are built.

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

- [Product scope](docs/product-scope.md)
- [Architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [Architecture decision records](docs/adr/README.md)
- [Best practices](docs/best-practices.md)
- [Design](docs/design.md)
- [Folder structure](docs/folder-structure.md)
- [Testing](docs/testing.md)
- [Accessibility](docs/accessibility.md)
- [Agent guidance](AGENTS.md)
- [Contributing](CONTRIBUTING.md)

Hosting and deployment are intentionally undecided.
