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

## Data validation

Competition and media data under `data/` is community-contributed, so it is checked like code.
`npm run validate:data` parses every data file with its Zod schema and verifies cross-file
references. See [data model](data-model.md) for the full check list.

Cover the validator itself with unit tests, including fixtures that are deliberately invalid: a
validator that never rejects anything passes silently and is worse than none.

## CI

Pull requests and pushes to `main` run validation and E2E jobs. Failed Playwright runs upload an
HTML report for diagnosis.

A separate `data` job runs `npm run validate:data` so a data-only contribution gets a clear,
fast result without waiting on the browser suite.
