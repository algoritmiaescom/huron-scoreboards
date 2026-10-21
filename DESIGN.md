# Huron Scoreboards design specification

## Intent

Present Mexican ICPC history as a public, community-maintained archive: editorial headings,
generous page spacing, and dense, readable results. The interface is Spanish-language and
read-only. Visual polish must never imply that invented or incomplete records are official.
See [product scope](docs/product-scope.md) for navigation and selection behavior.

This document owns visual decisions. The implementation source is the single MUI theme in
`src/app/theme/appTheme.ts`. Architecture belongs in [ADRs](docs/adr/README.md), not here.

## Identity and palette

Club navy anchors the site; ICPC blue, yellow, and red provide accents and result semantics.
The approved club JPEG and ICPC PNG live in `public/brand/`; preserve their proportions and
legibility. School logos are optional and follow the separate contribution rules.

| Token                | Light     | Dark      | Purpose                      |
| -------------------- | --------- | --------- | ---------------------------- |
| `brand.navy`         | `#183F5D` | `#183F5D` | Hero surfaces and identity   |
| `brand.blue`         | `#547FC2` | `#547FC2` | Decorative supporting accent |
| `brand.yellow`       | `#F7B91B` | `#F7B91B` | Accent, focus, first solve   |
| `brand.red`          | `#B93423` | `#B93423` | Supporting error accent      |
| `primary.main`       | `#245E88` | `#88B5E8` | Links, selected controls     |
| `background.default` | `#F5F4EF` | `#071823` | Canvas                       |
| `background.paper`   | `#FFFFFF` | `#102B3D` | Cards and controls           |
| `text.primary`       | `#132B3C` | `#F5F8FA` | Main text                    |
| `text.secondary`     | `#5D6D78` | `#B7C5CE` | Supporting text              |

Theme-owned `scoreboard` tokens define unattempted, attempted, solved, first-solve, and qualified
surfaces. Attempted, solved, and first-solve have matching foreground tokens. Use icon/text
semantics as well as color: minus for unattempted, close plus attempts for attempted, check plus
attempts/minute for solved, bolt plus FTS for first solve, and explicit qualification text.
Multiple teams may share first solve.

Text/status contrast must be at least 4.5:1 on intended surfaces. Do not reuse decorative accent
colors for ordinary text without checking contrast in both modes.

## Typography and geometry

- Self-host Space Grotesk Variable for headings/interface and IBM Plex Mono at weights 500,
  600, and 700 for numerical data. Fontsource packages provide local assets, including Spanish
  glyphs; do not depend on a third-party font request.
- Use the `data` typography variant for reusable numeric styling; it renders an inline span
  by default. Ordinary text uses MUI variants rather than independent font rules.
- Headings use weight 700. H1 tracking is -0.055em with line height 0.94; h2 tracking is
  -0.045em with line height 1. Overlines use 0.18em tracking.
- Spacing uses the 8px MUI scale. Base shape radius is 16px; pill buttons/chips use 999px.
  Radius multipliers must be interpreted relative to the theme, not copied as raw pixels.
- Buttons have a 42px minimum height. Keep touch targets separated and large enough to operate.
- Borders and layered navy-tinted shadows establish hierarchy. Use theme-owned card/paper
  overrides instead of per-feature shadow recipes.
- Warm light surfaces, dark navy surfaces, radial canvas gradients, fine hero grids, and yellow
  ring accents form the visual language. Keep decorative elements out of the reading order and
  prevent them from expanding page width.

## Theme preference

Light is the default when no preference exists. The application restores `light` or `dark`
from localStorage key `huron-scoreboards.theme-mode` before rendering the themed content.
Explicit user changes update the UI and persist immediately; do not overwrite the saved value
merely because a provider mounted. An explicit initial mode is available for isolated tests.

Only the theme preference repository accesses browser storage. Values are validated with Zod.
An invalid value or blocked storage produces a diagnostic and a visible warning, not an
unexplained fallback. Failed reads use light mode; failed writes keep the selected mode for
the current visit. A successful subsequent selection clears the warning and repairs the value.
Preferences are browser-local and do not synchronize across devices; cross-tab synchronization
is not part of the current interaction contract.

The navigation exposes the provider's theme control in both desktop and mobile layouts.
Theme preference must not introduce browser persistence for competition records.

## Responsive layouts

The document must reflow at 320 CSS pixels without horizontal page overflow. Do not enforce a
360px body minimum. Use the MUI breakpoint scale: 600, 900, 1200, and 1536px.

- At 900px and above: full navigation and dense standings table. Below: navigation drawer and
  team cards with labeled, two-column problem grids.
- School cards use one column below 600px, two from 600px, and three from 1200px.
- Media uses one column below 900px, two from 900px, and three from 1200px.
- Use contained, labeled horizontal scrolling for intrinsically wide tables. Place/team/school
  stay sticky while problem columns scroll; the header remains sticky vertically. Column
  offsets must equal actual rendered widths, including borders/padding, to avoid overlap.
- Result cells have a minimum 68 x 48px footprint; problem columns start at 84px. Preserve
  information in mobile cards rather than dropping columns silently.
- Charts and media fit their containers. Long names, missing metadata, many chips, and short
  landscape viewports must not obscure essential actions.

Verify each changed route in both themes at 320 x 568, 390 x 844, 844 x 390, 768 x 1024,
1024 x 768, 1440 x 900, and 1920 x 1080. Check one pixel below/at/above used breakpoints,
live resizing without state loss, touch/keyboard use, and 200% zoom. At 400% zoom on a
1280px desktop, verify 320-CSS-pixel-equivalent reflow. See the
[implementation plan](docs/implementation-plan.md) for the acceptance gate.

## Interaction and accessible states

- Navigation has active-state treatment, a main landmark/skip link, and an accessible drawer.
- Contest selection, filters, active chips, counts, filtered badges, clear-all, and share actions
  follow the URL contract in product scope. Never re-rank official placements after filtering.
- Result cells provide full descriptions on keyboard focus and hover, visible focus, and
  problem labels. Focus must scroll the containing table without hiding the selected cell.
  A tap or click also opens the description; Escape, focus leaving the cell, or an outside
  interaction dismisses it. Keep the complete accessible name available even when closed.
- Accumulated standings show published scores, explicit qualification labels, provenance,
  and a cut indicator only when supported by the published rows.
- School pages distinguish unit-only and institution-rollup scope. Charts reverse the place
  axis so first is highest, derive domains from records, and provide exact keyboard-accessible
  values with text/table equivalents.
- Media cards show author/source/time, optional content, descriptive alt text, accessible
  carousel controls, and a required original permalink. Videos need honest playback or an
  original-post action, not a nonfunctional play overlay.
- Every data surface distinguishes loading, empty, invalid selection, unavailable, and error
  states as applicable. Do not describe a live-source outage when no live integration exists.
- Correction actions link to GitHub and explain the official-evidence requirement.

### Standings controls and sharing

Filter controls use an outlined panel with a single column on phones, two columns from 600px,
and a horizontal control row from 1200px. Toggle buttons pair icons with text and expose their
pressed state. Active chips wrap, including long names; activating or deleting a chip removes
only that filter. Counts and the filtered badge remain visible alongside clear/share actions.
Keep every problem column when filtering and preserve official places.

Invalid values have explicit explanations and removal actions rather than silently reverting
to an unfiltered result. Empty matches offer selection-preserving clear-all. A copied-link
announcement appears only after the clipboard write resolves and expires when the URL changes.
Clipboard failures offer a labeled, read-only URL that selects on focus in a dismissible dialog.

### Scoreboard presentation primitives

Table cells and ordered two-column result grids reuse the same result component. They receive
derived first-solve flags rather than calculating scoring or changing stored results. The
visible value is attempts followed by solve minute when solved; FTS adds a bolt, text badge,
and yellow border. The legend explains all four appearances, accepted-attempt semantics,
and possible first-solve ties.

Team names are text rather than implicit headings. Rosters use a native disclosure; absent
rosters say "Integrantes no disponibles", and unspecified member roles remain unlabeled.
School identities preserve the competing unit's short and official names with optional location
and logo. Missing logos use a decorative school icon; failed images report "Logo no disponible".
Only callers with an available school destination supply a link.

Contest headers use a yellow top border, season/series/stage hierarchy, contest name, UTC-stable
calendar date, duration, per-contest penalty, and problem count. Source/correction actions are
reusable independently. Mock records explicitly identify invented results and an example source;
only archive records label the source as official. Do not add locations or hashtags absent
from the contest model.

### Accumulated standings

Accumulated headers retain the yellow border, season/series hierarchy, source and correction
actions, but show no invented contest date, duration, penalty, or problems. They explicitly
identify published scores and qualification; demonstration scores remain labeled as invented.
The shared picker calls the result choice "Clasificación" and lists an accumulated option only
for published records.

Desktop results use a five-column table (place, team, institution, published score,
qualification) in a focusable, vertically contained scroll region with a sticky header.
Below 900px, ordered cards present the same values, identities and roster disclosures.
Scores retain their stored precision, and official places including ties remain unchanged.
Qualified rows use the semantic qualified surface and an icon/text chip; unqualified rows
also carry explicit text. A thick primary-color rule and text label indicate a cut only when
the published row ordering supports a single, untied boundary. Do not infer a cut from a
qualified-only list or noncontiguous flags. School identities stay unlinked until their
history destinations exist. Sharing is reused; contest-only filters and legends are absent.

### School index

The school index uses a large editorial heading, a decorative yellow ring on wide screens,
and a raised, bounded search panel. School cards use a yellow rotated school badge, outlined
scope chip, identity/logo, and bottom-aligned statistics. Cards form one column below 600px,
two from 600px, and three from 1200px; long names, locations, scope labels and enlarged text
wrap without document overflow. Identity names are level-two headings beneath the page title.

Institution cards state that totals include their registered descendant units; unit cards state
that only exact-school results are included. A school with no registered units is labeled as such
without inventing an organizational type. Display best official contest placement and team-result
count separately from distinct contests. Zero results say "Sin resultados" instead of a fake rank.
Absent optional location fields are omitted; missing/failed logos reuse the identity fallback.
Search shows a live result count and distinct empty/no-match states with recovery.

School cards remain static, without action arrows, hover affordances, or broken destination
links until history pages exist. The index is accessible through "Instituciones" in both
desktop navigation and the mobile drawer, with an active-page indication.

## Focus and motion

Use a 3px yellow focus outline, 2px offset, and a 2px navy inner ring, visible in both themes.
Global focus specificity must override MUI input resets; verify actual computed styles.

Entrance motion uses a 500ms reveal-up with 18px translation. Button/icon transitions use
180ms; cards use 220ms. Honor `prefers-reduced-motion` by disabling smooth scrolling and making
animations/transitions effectively immediate. Essential meaning never depends on motion/hover.

## Implementation and review

Style with module-scope `styled()` components from `@mui/material/styles`, reading theme
tokens. Do not use `sx` or hard-code independent feature palettes. Promote UI to shared
components only when it is genuinely domain-neutral and reused.

Review fixed-fixture screenshots for populated, filtered, empty, accumulated, institution,
unit, media, contribution, and recovery states in both themes. Keep fonts, clocks, images, and
animation deterministic. Screenshots complement behavioral tests and manual accessibility
checks; they do not establish responsiveness by themselves.
