# Huron Scoreboards

The public site of the algorithms club at Huron. Its goal is to publish the historical standings
of Mexican ICPC programming competitions, surface archived community posts around the latest
contest, and let anyone correct the record through this repository.

Modules:

- **Scoreboards** — contest standings with per-problem attempts, accepted times, and
  first-to-solve highlights, plus filters and per-school historical pages.
- **Media feed** — curated repository posts for the latest held contest, with access to previous
  contests that have archived posts.
- **Contribution** — a guide for adding and correcting competition data through GitHub.

See [Product scope](docs/product-scope.md) for the full definition. The application provides contest and accumulated standings at `/scoreboards`, the curated feed at
`/media`, and the contribution guide at `/contribute` in a responsive shell. A searchable school
index is directly accessible at `/schools` (for example,
`/schools?q=UNAM`), linked as "Instituciones" in desktop and mobile navigation. Cards open
responsive per-school histories at `/schools/:schoolId`, with institution/unit scope, trends,
podiums, and contest destinations. The feed is linked as "Multimedia" in desktop and mobile
navigation; it reads only validated archive records and does not query social networks live.
The root redirects to standings.

## Prerequisites

- Node.js 24
- npm 11

## Getting started

```sh
nvm use
npm ci
npm run dev
```

Light/dark preferences persist locally through the navigation control. Standings include
responsive tables/cards, URL-backed contest filters, published accumulated scores and
qualification, and shareable views. Development defaults to the invented
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
The standings page explicitly identifies demonstration data and shows an empty state for the
currently empty real archive.

### Repository links

Set the GitHub repository URL and default branch in [src/app/config.ts](src/app/config.ts), then
set `repository.isPlaceholder` to `false`. All contribution and footer links are derived from
this configuration. Until the actual URL is available, the configured `OWNER/REPOSITORY` URL is
intentionally provisional and the guide warns that contributions cannot be submitted there yet.

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
