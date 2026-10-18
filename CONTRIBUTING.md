# Contributing

## Workflow

1. Use Node 24 (`nvm use`) and install with `npm ci`.
2. Create a focused branch from `main`.
3. Add or update tests with behavioral changes.
4. Run `npm run validate`.
5. Run `npm run test:e2e` for user-facing workflow changes.
6. Open a pull request and wait for CI.

Pre-commit checks run ESLint and Prettier against staged files. Do not bypass them to merge
unvalidated code.

## Competition data

Competition results are community-contributed and versioned in this repository as JSON under
`data/`. Corrections and new contests are submitted the same way as code: edit the data files and
open a pull request.

The real archive under `data/` is currently empty; `data/mock/` holds seed records with **invented
results** so the application has something to render. Mock data is a separate dataset, never a
staging area — transcribe results from an official scoreboard into `data/` rather than promoting
mock files. See [data/README.md](./data/README.md).

- Identify the season, series (GPM or Mexico finals), and stage (qualifier 1-3, repechage, or
  final) the change belongs to.
- Keep team, school, and problem identifiers consistent with existing records so historical
  school pages stay accurate.
- Record per problem: the number of attempts and, if solved, the minute it was accepted.
  **Attempts count every judged submission, including the accepted one** — a problem solved on
  the first try has 1 attempt, not 0.
- Do not record first-to-solve, solved counts, or penalty. They are derived from the solve times
  so they cannot disagree with them.
- Set the contest's penalty minutes per failed attempt from the official rules for that contest;
  it is not always 20.
- Record the official place as published, including ties.
- Link the official source or scoreboard evidence for every result you add or change.

For media posts, supply alt text for every image or video. Posts without it cannot be published.

Every data change is checked in CI by `npm run validate:data`, which parses each file against its
schema and verifies that cross-file references resolve. Run it locally before opening the pull
request; it reports every problem at once with the file and location.

See [data model](docs/data-model.md) for the full entity definitions.

The in-app contribution guide must stay consistent with this section.

## Pull requests

- Keep changes focused and explain user-visible behavior.
- Update directly related documentation.
- Include testing evidence.
- Do not introduce deployment assumptions until a hosting decision is recorded.
- Record significant architectural changes in `docs/adr/`. ADRs are for architecture only:
  coding standards belong in `docs/best-practices.md` and the lint config, visual decisions in
  `docs/design.md`, and feature scope in `docs/product-scope.md`. See `docs/adr/README.md`.
