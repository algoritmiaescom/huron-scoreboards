# Huron Scoreboards design system and interaction notes

## Foundation tokens

All screen values originate in the single MUI theme in `src/theme.ts`. Components use semantic theme paths rather than local color literals.

### Palette

| Token | Role | Contrast note |
| --- | --- | --- |
| `brand.navy` | Primary brand surface, derived from the club-logo ring | White text is approximately 10.7:1 |
| `primary.main` | Links, selected controls, focus-adjacent UI | White text is approximately 6.7:1 |
| `brand.blue` | Supporting brand accent from both logos | Used decoratively unless paired with tested text |
| `brand.yellow` | ICPC accent and first-to-solve outline | Navy text is approximately 8.9:1 |
| `brand.red` / `error.main` | Error and attempted-result emphasis | White text is approximately 5.3:1 |
| `success.main` | Solved and qualified semantics | White text is approximately 5.0:1 |
| `scoreboard.unattempted` | Neutral result background | Always includes a minus icon and accessible label |
| `scoreboard.attempted` / `attemptedText` | Attempted, unsolved result | Always includes a close icon and attempt count |
| `scoreboard.solved` / `solvedText` | Solved result | Always includes a check icon, attempt count, and solve minute |
| `scoreboard.firstSolve` / `firstSolveText` | First-to-solve overlay | Always includes a bolt icon and `FTS`; multiple cells may carry it |
| `scoreboard.qualified` | Accumulated-standing advancement | Always paired with a check icon and `Qualified` text |

The dark theme replaces surfaces and status backgrounds while preserving the same semantic token names. Focus is a three-pixel yellow outline with offset, visible against both themes.

### Type, spacing, shape, and elevation

- Display and interface: Space Grotesk, weights 400–700.
- Dense numeric data: IBM Plex Mono, weights 500–700.
- Type scale: MUI responsive `h1`–`h6`, body, caption, and overline variants.
- Spacing: MUI 8px base scale; screen spacing is expressed as theme-scale multiples.
- Radii: 8px small controls, 12px standard surfaces, 20px feature surfaces.
- Elevation: levels 0, 1, 3, and 8 only. Borders carry most hierarchy.

## Navigation model

- `Scoreboards`
  - Season selector (open list of available years)
  - Series selector (data-driven open set, currently GPM and Mexico Finals)
  - Contest selector (Qualifier 1–3, Repechage, Accumulated standing, or Final when available)
- `Schools`
  - Schools index
  - Institution or academic-unit history route
- `Media`
  - Most recent Contest hashtag feed
- `Contribute`
  - GitHub correction workflow

The selectors are data-driven and do not assume every Season has every Series, stage, Repechage, accumulation, or Final.

## Screen and state inventory

- Contest standing: desktop pinned-column table and narrow-screen team cards.
- Filtered contest standing: URL-backed controls, active chips, result count, filtered-view badge, share action, and clear-all.
- Empty filtered result: explanation and clear-all action.
- Partial Season: warning explaining missing historical stages.
- Accumulated standing: official published scores, qualified labels, visible cut line, provenance, and source.
- Schools index: institution and unit labels, location, best placement, and result volume.
- School history: institution-rollup/unit-only banner, trends, podiums, participation, rosters, and linked Contest records.
- Media feed: source/author metadata, image/video carousel, alt text, hashtags, and required original permalink.
- Media loading: skeleton cards (`/media?state=loading`).
- Media empty: event-specific no-post state (`/media?state=empty`).
- Media unavailable: rate-limit notice plus identically styled repository fallback posts (`/media?state=unavailable`).
- Contribute: evidence and review expectations plus primary GitHub action.
- 404: recovery route and absent Season/Series/Contest language.

## Component inventory

- `ProblemResultCell`: unattempted, attempted, solved, and first-to-solve states. Each has text/icon semantics, tooltip, accessible name, and keyboard focus. Ties are represented by applying FTS to any number of cells.
- Contest header: breadcrumb hierarchy, date, location, duration, per-Contest penalty rule, source attribution, and correction link.
- Standings row/card: place, Season-scoped team, school or unit, roster-absence treatment, results, solved count, and penalty.
- Filter bar and chips: team, school, problem, solved, and first-to-solve criteria.
- Accumulated row: score, explicit advancement state, and qualification cut line.
- School scope banner: distinguishes institution rollup from one academic unit.
- Trend chart and podium list: visible summaries and text/table equivalents.
- Post card: source, profile, timestamp, title/body, carousel assets, hashtags, and permalink.
- Source callout: official source link and community-contributed provenance.

## Interaction notes

### Dense table

- Desktop keeps Place, Team, and School sticky while the problem region scrolls horizontally.
- The table header remains sticky during vertical scanning.
- Every result cell can receive keyboard focus; focus scrolls the containing table to the selected problem.
- Focused cells expose the same complete result string as hover tooltips.
- Mobile replaces the 8–13-column matrix with one card per team and a two-column labeled problem grid.

### Filters and URL sharing

- Filter values are encoded in URL search parameters.
- Filters combine using AND semantics.
- Active filter chips can be removed individually.
- The filtered-view badge and result count prevent accidental confusion with official unfiltered standings.
- Share copies the current URL; clear-all preserves only the selected Contest.

### Charts

- Hover/focus tooltips reveal exact values.
- The place axis is reversed so first place is visually highest.
- Nearby summaries and the result table prevent chart-only access to information.

### Media

- Carousel controls have explicit previous/next accessible names.
- Every asset has required alt text in the data model.
- Live and repository-archived post cards use the same component and have no per-card visual distinction.
- All posts end with a visible link to the original public permalink.
