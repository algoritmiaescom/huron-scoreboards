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

## CI

Pull requests and pushes to `main` run validation and E2E jobs. Failed Playwright runs upload an
HTML report for diagnosis.
