# Testing

## Unit and component tests

Vitest, Testing Library, and `user-event` cover domain boundaries and user behavior. Tests live
next to the code they exercise; shared setup lives in `src/test/`.

Coverage minimums are:

- 90% lines
- 80% functions
- 70% statements
- 50% branches

The React Compiler generates memoization code that v8 counts as uncovered statements and
branches, so line and function coverage are the meaningful gates. Raise these thresholds as real
application logic is added.

Run `npm run test:coverage` to enforce them.

## End-to-end tests

Playwright covers critical workflows in Chromium. The suite builds and previews the production
application automatically.

```sh
npx playwright install chromium
npm run test:e2e
```

Add an E2E test for a critical cross-page workflow, not for every component variation.

The placeholder's foundation checks cover locally served fonts, the initial light palette,
saved-theme restoration, and document overflow across the implementation plan's seven viewport sizes. The shared tooling/E2E
TypeScript project includes DOM types because Playwright evaluations execute in the browser.
Theme unit tests cover both palettes, status contrast, and provider mode changes.
The scripts TypeScript project includes scripts and their transitive domain dependencies,
not all browser source files; browser code is checked by the application project.

## Data validation

Competition and media data under `data/` is community-contributed, so it is checked like code.
`npm run validate:data` parses every data file with its Zod schema and verifies cross-file
references. See [data model](data-model.md) for the full check list.

Cover the validator itself with unit tests, including fixtures that are deliberately invalid: a
validator that never rejects anything passes silently and is worse than none.

Runtime repository tests exercise the actual development files as well as injected malformed
JSON, schema failures, load failures, broken references, missing records, and empty archives.
They verify dataset isolation and that a media failure leaves valid standings available.
The production-bundle test builds the data composition entry with the production environment,
checks that no mock modules were included, and executes the bundle to verify the currently
empty real archive without a mock fallback.
Development selection tests cover the unset default, explicit `mock`/`archive` values and
invalid configuration errors. Production-bundle tests verify that `mock`, `archive` and invalid
`VITE_DATA_SOURCE` values all leave production restricted to the real archive.

Pure selector tests cover contest-specific penalties, tied first solves before filtering,
official places, AND filters, sparse catalogs, published accumulated scores, safe qualification
cuts, transitive school scope, season-scoped teams, optional metadata, and ordered event posts.
Feed composition tests use the Mexico City date boundary and reject substitution of older,
future, or unlinked events. These are data-layer checks, not completed feature-screen E2E coverage.

## CI

Pull requests and pushes to `main` run validation and E2E jobs. Failed Playwright runs upload an
HTML report for diagnosis.

A separate `data` job runs `npm run validate:data` so a data-only contribution gets a clear,
fast result without waiting on the browser suite.
