# Project guidance

## Required workflow

- Use Node 24 and npm 11.
- Install dependencies with `npm ci`.
- Run `npm run validate` before considering work complete.
- Run `npm run test:e2e` for user-facing workflows.
- Use semicolons; formatting is owned by Prettier.

## Architecture

- The application currently renders only an "Under construction" screen; there is no routing,
  domain feature, or persistence yet.
- Keep domain code in `src/features/<feature>/`.
- Keep application composition and top-level screens in `src/app/`.
- Keep reusable, domain-neutral UI in `src/components/`.
- Access persistence through repository interfaces; components must not use browser storage.
- Use local React state for local UI, React Hook Form for forms, Zustand for shared client state,
  and route/search parameters for URL state.
- Do not add an asynchronous state library until the application has server state.
- Do not add hosting or deployment configuration until that decision is made.

See `docs/architecture.md`, `docs/best-practices.md`, and `docs/folder-structure.md` for details.
