# Huron Scoreboards — implementation plan

## Goal

Build a polished, responsive Spanish-language front-end prototype for the college algorithms club. The app will expose two primary modules:

1. Historical ICPC México standings and school performance.
2. A curated media feed for the latest competition hashtag.

The prototype will use realistic local fixture data and working interactions, but will not add a backend, authentication, live social-network ingestion, or an organizer CMS.

## Current repository and asset findings

- The repository is a minimal React 19 + Vite 8 + Tailwind CSS v4 scaffold.
- `src/App.tsx` is currently empty aside from a centered container.
- There is no router, icon library, chart library, API client, or existing design system.
- The supplied club logo is a square JPEG centered around deep navy/blue, white, black linework, and a small periwinkle accent.
- The supplied ICPC México logo is a transparent PNG with black typography plus blue, yellow, and red marks.
- Both supplied logos will be copied into the app’s public assets and used in the interface; the club logo is the primary brand, while the ICPC mark appears as competition attribution/context.

## Information architecture and routes

Use React Router in Data mode with `RouterProvider`, following the repository’s React setup:

- `/` redirects to `/scoreboards`.
- `/scoreboards` is the main contest standings route.
- `/schools` is the historical school index/ranking route.
- `/schools/:schoolId` is a school performance detail route.
- `/media` is the current competition media feed.
- `*` renders a branded not-found state with a route back to the standings.

Create `src/app/App.tsx` as the routed application entry, `src/app/routes.tsx` for route definitions, and update `src/main.tsx` to mount the new app entry. A shared root layout will own navigation, global background, and footer.

Desktop navigation will use a compact top header. Small screens will use a condensed header plus an accessible mobile navigation drawer rather than compressing the desktop links.

## Visual direction

Create a purposeful “competition control room meets college editorial” style rather than a generic admin dashboard:

- Warm off-white page canvas with deep navy surfaces and white data cards.
- Club navy as the primary anchor; royal blue for selected/navigation states; ICPC yellow for winners, active accents, and first-to-solve; ICPC red for penalties or unsolved/rejected status.
- Define reusable color, radius, shadow, typography, and spacing tokens in `src/index.css`.
- Use a public Google font pairing: **Space Grotesk** for headings/interface and **IBM Plex Mono** for ranks, timestamps, penalties, and problem statistics.
- Use fine grid lines, restrained rounded corners, compact labels, and strong numeric hierarchy. Avoid excessive pill-shaped cards.
- Use Lucide icons for interface symbols rather than hand-drawn SVG icons or emoji.
- Preserve generous whitespace around both logos; use the circular club logo as the app identity and the ICPC logo only where contest context is being established.
- Add subtle route/card entrance transitions and responsive hover/focus states, while honoring `prefers-reduced-motion`.

Initial design tokens:

- Primary navy: approximately `#1F4F73`.
- Primary blue: approximately `#547FC2`.
- Accent yellow: approximately `#F7B91B`.
- Accent red: approximately `#BF2D1B`.
- Ink: near-black navy.
- Canvas: warm white rather than pure gray.

The exact token values can be tuned visually against the embedded source logos during implementation.

## Dependencies

Add only the dependencies needed for this prototype:

- `react-router` for routed pages and URL-aware navigation.
- `lucide-react` for consistent interface iconography.
- `recharts` for accessible responsive school-history visualizations.

No state-management or component-library dependency is needed. React state, route/search parameters, and focused local components are sufficient.

## Data model and fixture content

Create typed models in `src/data/types.ts` and realistic local fixtures in `src/data/mockData.ts`.

### Competition hierarchy

- `Season`: year, display label, and contests.
- `Contest`: id, year, stage type, stage label, date, venue, hashtag, duration, status, problem definitions, standings, and media references.
- Stage types cover `qualifier-1`, `qualifier-2`, `qualifier-3`, `repechage`, and `final`.
- Fixture data will cover multiple recent years so historical controls and school trend charts feel credible. Not every season must have all three qualifier rounds because the domain allows “up to three.”

### Standing and problem result

- `Standing`: place, team id/name, school id/name/abbreviation, member names, solved count, penalty, and per-problem results.
- `Problem`: id/letter, title, color, acceptance count, and first-solve team.
- `ProblemResult`: status (`accepted`, `attempted`, or `unattempted`), attempts, accepted minute when applicable, penalty contribution, and `firstToSolve`.

Problem cells will display:

- Accepted: solve indicator, attempts, and accepted contest time.
- First to solve: highlighted treatment plus explicit icon/label available via tooltip or accessible text.
- Attempted but unsolved: failed attempt count.
- Unattempted: neutral dash.

### School history

Derive school summaries from the standings fixtures instead of duplicating values:

- Appearances and finals appearances.
- Best placement.
- Podium totals (gold/silver/bronze).
- Total solved problems.
- Year-over-year placement/solved trend.
- Recent teams and best performances.

### Media

- `MediaPost`: id, author, handle, provider label, timestamp, caption, media type, image URL, alt text, related team/school, likes, and contest id.
- Use curated mock posts tied to the latest contest hashtag.
- Select a small, cohesive set of relevant programming-contest/student-team photography through the Unsplash workflow during implementation, with clear alt text and gradient/color fallbacks.

## Shared app shell

Build a reusable shell with:

- Brand lockup: club logo and “huron-scoreboards”.
- Primary links: `Marcadores`, `Escuelas`, and `Comunidad`.
- Small “ICPC México” context mark or competition badge without implying the app is an official ICPC property.
- Active-route indication, keyboard-visible focus states, and mobile navigation.
- A restrained footer with club identity, prototype/data note, and current year.

## Scoreboards route

### Competition header

- Eyebrow identifying “Temporada ICPC México”.
- Event title, stage, date, venue, and status.
- Year selector and round selector representing qualifiers, repechage, and final.
- ICPC logo in a reserved attribution area.
- Summary metrics for participating teams, represented schools, problem count, and total accepted submissions.

Changing year or round updates the visible contest, summaries, problem metadata, standings, and hashtag link. Keep selected year/stage and filters in URL search parameters so views are reloadable and shareable.

### Filters

Provide a compact desktop filter bar and a collapsible mobile filter panel:

- Text search across team and school.
- School selector.
- Problem selector.
- Problem status selector (`resuelto`, `intentado`, `sin intento`).
- Minimum accepted-problem count.
- “Primero en resolver” toggle.
- Visible result count and a single “Limpiar filtros” action.

Filters combine predictably with AND semantics. Invalid or stale URL parameter values fall back safely to defaults. A no-results state explains that filters can be cleared.

### Standings table

- Preserve canonical place order; filters narrow rows without recomputing official place.
- Sticky rank and team/school columns on wider table layouts.
- Horizontally scrollable problem columns on narrow screens.
- Table header shows problem letter and acceptance summary, with title available in supporting text/tooltip.
- Team cell includes team name, school abbreviation/name, and members in progressive detail.
- Final columns show total solved and penalty.
- Top three rows receive restrained podium treatments.
- Include an always-visible legend for accepted, first-to-solve, attempted, and unattempted states.
- On very small screens, retain the real table with sticky identity columns rather than converting the standings into cards, preserving problem-to-team comparison.

## Schools routes

### School index (`/schools`)

- Intro and aggregate metrics for the selected historical range.
- Searchable list/table of schools ranked by historical performance.
- Each school preview shows appearances, podiums, best place, total solved, and a compact trend sparkline.
- Selecting a school navigates to its stable slug route.

### School detail (`/schools/:schoolId`)

- Branded school summary header with abbreviation, full name, headline metrics, and best finish.
- Podium display with gold/silver/bronze totals and notable finishes.
- Responsive line chart for placement trend, with the rank axis visually inverted so first place appears higher.
- Secondary solved-problems trend chart by season.
- Historical appearance table listing year, contest stage, team, place, solved, and penalty.
- A “mejores participaciones” section highlighting top performances.
- Unknown school ids render a useful inline not-found state linking back to the school index.

Charts will include textual summaries and table equivalents so information is not available only by color or hover.

## Media route

- Hero for the latest completed contest with event name, date, and prominent hashtag.
- Editorial masonry-style feed on desktop and a single-column feed on mobile.
- Cards support image and text variants and show author, timestamp, caption, provider label, engagement, and optional school/team context.
- Add filter chips for `Todo`, `Equipos`, `Premiación`, and `Detrás de cámaras`; these operate on local fixture tags.
- Image cards open an accessible lightbox/detail dialog with caption and metadata.
- Include a clear prototype notice that the feed is curated sample content, not a live social stream.
- Empty and image-load-failure states use branded gradients and text rather than broken image icons.

## Component organization

Keep components focused and reusable without introducing an oversized abstraction layer:

- `src/app/` — routed app entry, route definitions, root layout.
- `src/components/layout/` — header, mobile navigation, footer.
- `src/components/scoreboard/` — contest selector, filter bar, standings table, problem cell, legend.
- `src/components/schools/` — school card/table, metric cards, podium summary, chart wrappers.
- `src/components/media/` — media card, media filters, lightbox.
- `src/components/ui/` — only repeated primitives such as button, select, badge, empty state, and metric block.
- `src/pages/` — route-level composition.
- `src/data/` — types, fixtures, and pure derivation/filter helpers.
- `src/assets/` or `public/brand/` — normalized copies of the two uploaded logos.

Use pure helper functions for contest lookup, scoreboard filtering, school aggregation, and number/time formatting. This makes the fixture data easy to replace with API responses later.

## Responsive, accessibility, and edge-case behavior

- Support desktop, tablet, and phone widths without clipping global navigation or losing table identity context.
- Use semantic landmarks, headings, forms, labels, tables, and dialog behavior.
- Ensure all controls are keyboard accessible and have visible focus rings.
- Never rely on red/green or color alone for result status; pair color with icons/text and accessible labels.
- Provide useful alt text for logos and media.
- Give charts accessible labels and nearby numerical summaries.
- Handle missing contest rounds, no filter matches, unknown schools, missing images, long team/school names, and contests with different problem counts.
- Format dates and interface copy with Mexican Spanish conventions.

## Implementation sequence

1. Copy/normalize the supplied logos into public brand assets and add the three scoped dependencies.
2. Establish typography, Tailwind v4 theme tokens, global canvas styles, focus treatment, and reduced-motion behavior.
3. Add React Router Data mode, shared layout, desktop/mobile navigation, and not-found handling.
4. Define typed contest/media models and realistic multi-season fixtures; add pure filtering and school-aggregation helpers.
5. Build the standings route, event selectors, URL-synchronized filters, status legend, and responsive standings table.
6. Build the school index and routed school detail with derived metrics, podium summaries, Recharts visualizations, and history tables.
7. Use the Unsplash workflow to select suitable competition/team imagery, then build the curated feed, category filters, loading fallbacks, and accessible detail dialog.
8. Polish responsive states, typography, transitions, empty states, and brand-logo balance.

## Verification

- Run the repository formatter through `pnpm format`.
- Run `pnpm build` to catch TypeScript, JSX, asset, and route integration failures.
- Inspect the existing hot-reloaded preview; do not start another development server.
- Manually verify:
  - Every route and active navigation state.
  - Direct loading of a school detail URL and the wildcard route.
  - Year/round selection and persistence through URL search parameters.
  - Every filter individually and in combination, including clear/no-results behavior.
  - Problem-cell rendering for accepted, first-to-solve, attempted, and unattempted cases.
  - School aggregates and charts against the fixture rows.
  - Media category filtering, lightbox keyboard behavior, and image fallback.
  - Desktop, tablet, and narrow-phone layouts, especially sticky/horizontal standings behavior.
  - Keyboard navigation, focus visibility, reduced motion, and non-color status cues.

## Acceptance criteria

- The app is an exhibition-quality Spanish prototype with a coherent brand derived from both supplied logos.
- All requested competition stages and scoreboard result details can be represented by the data model.
- Users can switch historical contests and filter standings by team/school, problem result, accepted count, and first-to-solve status.
- Users can browse schools and open a detailed historical performance page with charts and podium results.
- Users can browse and filter a realistic latest-event hashtag feed.
- The interface remains usable and legible across desktop and mobile.
- Routes are directly addressable, fixture-driven interactions work without a backend, and the production build succeeds.
