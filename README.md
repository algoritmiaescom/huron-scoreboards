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

The application still serves a placeholder screen. Light/dark preferences persist locally;
validated scoreboard/media repositories and domain selectors are ready for future screens.
Routing and feature UI are not implemented yet. Data-layer development defaults to the invented
`data/mock/` dataset; production excludes it and uses only the real archive (currently empty).

### Development dataset

Set `VITE_DATA_SOURCE` to `mock` for `data/mock/` or `archive` for the real `data/` archive.
Copy [.env.example](.env.example) to `.env.local` to save your local choice, or set it inline:

```sh
VITE_DATA_SOURCE=archive npm run dev
```

Restart the development server after changing the environment file. Unset defaults to `mock`;
invalid values produce an explicit configuration error when repositories load. Production builds
always use `archive`, regardless of this variable, and never fall back to mock records.
The current placeholder does not display competition data yet.

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
| `npm run validate:data` | Validate repository data against Zod schemas      |
| `npm run validate`      | Run all non-E2E quality checks                    |

## Documentation

- [Product scope](docs/product-scope.md)
- [Implementation plan](docs/implementation-plan.md)
- [Architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [Architecture decision records](docs/adr/README.md)
- [Best practices](docs/best-practices.md)
- [Design](docs/design.md)
- [Design specification](DESIGN.md)
- [Folder structure](docs/folder-structure.md)
- [Testing](docs/testing.md)
- [Accessibility](docs/accessibility.md)
- [Agent guidance](AGENTS.md)
- [Contributing](CONTRIBUTING.md)

Hosting and deployment are intentionally undecided.
