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

## Pull requests

- Keep changes focused and explain user-visible behavior.
- Update directly related documentation.
- Include testing evidence.
- Do not introduce deployment assumptions until a hosting decision is recorded.
- Record significant architectural changes in `docs/adr/`.
