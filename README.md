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
The root redirects to standings. These are client routes: public URLs use `#/scoreboards`,
`#/schools`, and so on so shared links and refreshes work on GitHub Pages.

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
- [Standings ingestion with GitHub Actions](docs/standings-ingestion.md)
- [Standings ingestion architecture](docs/adr/0008-ingest-standings-through-reviewed-proposals.md)
- [Architecture decision records](docs/adr/README.md)
- [Best practices](docs/best-practices.md)
- [Design](docs/design.md)
- [Design specification](DESIGN.md)
- [Folder structure](docs/folder-structure.md)
- [Testing](docs/testing.md)
- [Accessibility](docs/accessibility.md)
- [Agent guidance](AGENTS.md)
- [Contributing](CONTRIBUTING.md)

## Deployment

The site is published to <https://algoritmiaescom.github.io/huron-scoreboards/>.

One-time repository setup: open **Settings → Pages → Build and deployment** and select
**GitHub Actions** as the source. If environment protection rules are configured, allow `main`
to deploy to the `github-pages` environment.

The [CI workflow](.github/workflows/ci.yml) uploads the validated production bundle and deploys
it after all Python, application, data, and browser checks succeed on a push to `main`.
Pull requests run checks without publishing. To redeploy, run **CI** from the **Actions** tab
with branch `main`. No personal access token or `gh-pages` branch is required.

The build uses `VITE_BASE_PATH=/huron-scoreboards/` (derived from the repository name in CI).
Assets respect this prefix; navigation and filters live after `#`, for example
`https://algoritmiaescom.github.io/huron-scoreboards/#/schools?q=UNAM`.
Only the real archive is included in production.

To preview the Pages layout locally:

```sh
VITE_BASE_PATH=/huron-scoreboards/ npm run build
npm run preview -- --base /huron-scoreboards/
```

See [ADR 0009](docs/adr/0009-deploy-to-github-pages.md) for the hosting and routing decision.
