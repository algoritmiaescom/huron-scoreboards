# Design

Visual decisions live here and in `src/app/theme/`. They are not architecture decision records.

## Visual identity

The theme derives from the club logo and the ICPC logo.

The concrete palette is not decided yet. The logos have not been added to the repository, so the
application still uses the provisional theme in `src/app/theme/appTheme.ts`. Once the logos land,
pick the palette from them, update the theme tokens, and update this section. Do not open an ADR
for it.

## Theme

- One Material UI theme owns the palette, typography, shape, and spacing scale.
- Add a design value to the theme before using it in a component.
- Read values through the theme in styled components; do not hard-code colors, spacing, or font
  sizes in feature code.

## Styling

Components are styled with `styled()` from `@mui/material/styles`; the `sx` prop is rejected by
ESLint. See [best practices](best-practices.md) for the rules and rationale.

## Scoreboard display

The standings table is wide and dense, so visual decisions there carry accessibility weight:

- Never encode meaning by color alone. Accepted, attempted, and first-to-solve states need a
  text, icon, or shape difference as well.
- Keep place, team, and school readable while the problem columns scroll.
- Maintain contrast from theme tokens rather than per-cell overrides.

See [accessibility](accessibility.md) for the requirements these follow.
