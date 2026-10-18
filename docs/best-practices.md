# Best practices

## TypeScript

- Preserve strict and type-aware checks.
- Validate untrusted runtime data with Zod.
- Prefer inferred or explicit types over assertions.
- Use type-only imports where applicable.
- Never ignore a promise without making the decision explicit.

## React

- Keep components focused on rendering and interaction.
- Keep domain logic and persistence out of generic components.
- Declare components, hooks, and helpers as arrow functions assigned to a `const`; do not use
  `function` declarations or expressions.
- Prefer composition over configurable components with many flags.
- Use semantic HTML and accessible names.
- Use Material UI theme tokens rather than unrelated hard-coded design systems. Visual decisions
  are documented in [design](design.md).

## Styling

- Style with `styled()` components from `@mui/material/styles`; do not use the `sx` prop.
- Define styled components at module scope, above the component that uses them, so they are not
  recreated on render.
- Read design values from the theme callback (`styled(X)(({ theme }) => ...)`) instead of
  hard-coding colors, spacing, or font sizes.
- Keep layout-only props (`spacing`, `maxWidth`, `variant`) on the Material UI component; move
  visual styling into the styled component.

ESLint enforces both rules: `func-style`, `prefer-arrow-callback`, and a `no-restricted-syntax`
ban on function expressions and on the `sx` JSX attribute.

## State

- Do not put local dialog or input state in Zustand.
- Do not read `localStorage` from components.
- Do not duplicate route state in a store.
- Introduce remote-state tooling only when remote state exists.

## Imports and boundaries

- Use the `@/` alias for source imports.
- A feature must not import another feature's internal modules.
- Shared components must remain domain-neutral.
- Infrastructure implements interfaces owned by the relevant domain boundary.

## Change quality

- Test user-visible behavior rather than implementation details.
- Update documentation when architecture or workflows change.
- Run the smallest relevant checks during development and `npm run validate` before completion.
- Prefer an enforceable rule over prose. A convention that can be a lint rule, a Prettier
  setting, or a type belongs in configuration, not in a document.
- Write a new convention here, not in `docs/adr/`. ADRs are reserved for architecture; see
  [adr/README.md](adr/README.md).
