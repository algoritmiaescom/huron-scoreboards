# Agent guidance

Guidance for coding agents and contributors working in this repository. `CLAUDE.md` points here;
keep this file as the single source.

## Product goal

Huron Scoreboards publishes the historical standings of Mexican ICPC competitions (yearly
seasons holding the GPM, with up to three qualifiers plus a repechage and an accumulated
standing, and the Mexico finals), a media feed for the latest contest hashtag, and a guide for
correcting competition data through GitHub. See `docs/product-scope.md` and `docs/data-model.md`.

## Required workflow

- Use Node 24 and npm 11.
- Install dependencies with `npm ci`.
- Run `npm run validate` before considering work complete.
- Run `npm run test:e2e` for user-facing workflows.
- Use semicolons; formatting is owned by Prettier.
- Write arrow functions assigned to a `const`; `function` declarations and expressions are
  rejected by ESLint.
- Style with `styled()` from `@mui/material/styles`; the `sx` prop is rejected by ESLint.

## Architecture

- The application currently renders only an "Under construction" screen; there is no routing,
  domain feature, or persistence yet.
- Keep domain code in `src/features/<feature>/`. Planned features: `scoreboards`, `media-feed`,
  and `contribution`.
- Keep application composition and top-level screens in `src/app/`.
- Keep reusable, domain-neutral UI in `src/components/`.
- Access persistence through repository interfaces; components must not use browser storage.
- Competition data is versioned in the repository as JSON under `data/` and read through a
  repository interface; validate it with Zod because it is community-contributed. The entities,
  and which values are stored versus derived, are defined in `docs/data-model.md`.
- Data is validated twice from one set of Zod schemas: by `npm run validate:data` in CI before a
  change merges, and at the repository boundary when the application loads it. Infer domain types
  from the schemas with `z.infer` so they cannot drift.
- Use local React state for local UI, React Hook Form for forms, Zustand for shared client state,
  and route/search parameters for URL state, including scoreboard filters.
- Do not add an asynchronous state library until the application has server state.
- Do not add hosting or deployment configuration until that decision is made.
- The color palette derived from the club and ICPC logos is not decided yet; use theme tokens and
  do not hard-code colors.

## Where decisions are written

- `docs/adr/` is for architecture only: technology selection, module boundaries, data flow,
  persistence, and integrations. Do not add an ADR for a coding standard or a visual choice.
- Coding standards go in `docs/best-practices.md` and, whenever possible, become a lint rule in
  `eslint.config.js` instead of prose.
- Visual identity, palette, and theming go in `docs/design.md` and `src/app/theme/`.
- Product scope and module behavior go in `docs/product-scope.md`.
- Domain entities and their rules go in `docs/data-model.md`.

See `docs/architecture.md`, `docs/best-practices.md`, `docs/design.md`,
`docs/folder-structure.md`, and `docs/adr/README.md` for details.
