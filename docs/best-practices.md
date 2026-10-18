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
- Prefer composition over configurable components with many flags.
- Use semantic HTML and accessible names.
- Use Material UI theme tokens rather than unrelated hard-coded design systems.

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
