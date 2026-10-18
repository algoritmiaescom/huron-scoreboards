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

Competition results are community-contributed and versioned in this repository. Corrections and
new contests are submitted the same way as code: edit the data files and open a pull request.

- Identify the season and stage (qualifier 1-3, repechage, or Mexico finals) the change belongs
  to.
- Keep team, school, and problem identifiers consistent with existing records so historical
  school pages stay accurate.
- Include the per-problem detail the standings need: attempts, acceptance time, and first-to-
  solve information.
- Link the official source or scoreboard evidence for every result you add or change.

The in-app contribution guide must stay consistent with this section.

## Pull requests

- Keep changes focused and explain user-visible behavior.
- Update directly related documentation.
- Include testing evidence.
- Do not introduce deployment assumptions until a hosting decision is recorded.
- Record significant architectural changes in `docs/adr/`. ADRs are for architecture only:
  coding standards belong in `docs/best-practices.md` and the lint config, visual decisions in
  `docs/design.md`, and feature scope in `docs/product-scope.md`. See `docs/adr/README.md`.
