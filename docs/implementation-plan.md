# Incremental implementation plan

## Goal and constraints

Deliver the Spanish-language archive incrementally through focused, reviewable milestones.
Each milestone needs persistent code, acceptance evidence, and an updated progress entry.
The [design specification](../DESIGN.md), [product scope](product-scope.md),
[data model](data-model.md), [architecture](architecture.md), and
[coding guidelines](best-practices.md) govern implementation.

- Development defaults to the existing [mock dataset](../data/mock/); `VITE_DATA_SOURCE=archive`
  selects the real archive locally (`mock` selects seed data). Production ignores this setting
  and uses only the real archive and honest empty states, never silent mock fallbacks.
- Media starts with repository-backed events/posts. Keep reusable loading, empty, unavailable,
  and error presentations; defer live integration and async-state tooling.
- Use installed React/MUI APIs and repository tooling. Do not introduce parallel domain types,
  duplicate configuration, monolithic route components, or unrelated dependencies.
- Preserve the agreed visual language and functionality while enforcing model correctness,
  responsiveness, accessibility, and repository boundaries.

## Progress

| Milestone                        | Status      | Evidence / next action                                                                                                                         |
| -------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Design and behavior contracts | Complete    | Route/filter/media contracts approved; design values, responsive rules, and screen/state inventory recorded                                    |
| 1. Visual foundation             | Complete    | Light/dark theme, local fonts, approved branding, provider controls; 37 tests, 3 E2E tests, and 38 responsive sample checks passed             |
| Theme preference follow-up       | Complete    | Validated localStorage repository, saved-theme restore and storage-failure tests; 46 unit tests and 4 E2E tests passed                         |
| 2. Runtime data and selectors    | Complete    | Validated repositories, production bundle isolation, scoring/filter/history/feed selectors; 81 unit tests and 4 E2E tests passed               |
| 3. Routing, shell, contribution  | Complete    | Responsive shell, contribution guide, loading/error recovery; 95 unit tests and 13 E2E tests passed; repository URL provisional by approval    |
| 4. Scoreboard primitives         | Complete    | Reusable results, identities, header, legend and provenance; 114 unit tests and 18 E2E tests passed; responsive/accessibility fixture verified |
| 5. Contest standings             | Complete    | Released standings/root redirect, data-driven selection, tables/cards, provenance and recovery; unit/browser acceptance verified below         |
| 6. URL filtering and sharing     | Complete    | Typed URL filters, chips/counts, history/reload, clipboard recovery; 146 unit tests and 26 E2E tests passed                                    |
| 7. Accumulated standings         | Complete    | Published scores/qualification, safe cuts, URL recovery and sharing; 186 unit tests and 31 E2E tests passed                                    |
| 8-11. Remaining slices           | Not started | Follow explicit dependencies below                                                                                                             |

Initial visual review covered 13 route states in both themes at desktop/phone sizes (52
captures). Foundation verification covered seven sizes in each theme (14 captures), 19 widths
per mode, reduced motion, and computed keyboard focus. These are foundation checks, not claims
of completed route parity, physical-device testing, or a full zoom audit.

Update statuses only after exit criteria pass. Do not recreate temporary verification routes in
the shipping app. Next major milestone: school index (release navigation with school histories).

## Data and presentation rules

- Infer domain types from the existing Zod schemas and validate JSON at repository boundaries.
  Reuse reference validators without importing Node filesystem scripts into browser code.
- Join standing rows to season-scoped teams and schools; do not duplicate identities/rosters.
- Use `officialName`, `parentInstitutionId`, `Problem.label`, ordered result arrays, `seasonYear`,
  `source`, and canonical stages with Spanish labels.
- Keep official places and accumulated scores unchanged, including ties. Accumulation is a
  separate `SeasonStanding`, never a fictitious contest with invented dates/problems.
- Derive solved count and penalty in domain selectors. Penalty includes solved problems only:
  `solvedAtMinute + penaltyMinutesPerFailedAttempt * (attempts - 1)`. Attempts include acceptance.
- Derive every tied first solver from the whole unfiltered contest before applying filters.
- Discover available seasons/series/stages from data. Series ids remain open-ended; known ids
  get friendly labels and unknown ids a readable fallback.
- Missing optional stages do not prove incompleteness. Qualification rows may include only
  advancing teams or non-contiguous states; draw a single cut only when the ordering supports it.
- Resolve institutional descendants without duplicate results. Keep units and standalone schools
  distinct, and never connect a team's identity across years.
- Handle absent logos, names, locations, member roles, titles, and media without fabricated
  facts, broken links, or missing-value strings. Contests do not store location/hashtag;
  media-owned `Event` metadata does.
- Media uses `Post.author`, lowercase source ids, `postedAt`, `media`, `tags`, and event `postIds`.
  Status comes from repository results, not public simulation parameters.
- Genuine schema changes must update validation, inferred types, fixtures, data-model docs,
  and contribution guidance together.

## Ownership and reuse

```text
src/
  app/
    pages/                 Route-level and cross-feature composition
    components/            Shell, navigation, footer
    providers/             Theme and repository composition
    theme/                 Semantic tokens, controls, preference repository
    routes.tsx
  components/              Reused domain-neutral UI
  features/
    scoreboards/
      components/
      model/               Schemas, scoring, filters, history selectors
      repositories/
    media/
      components/
      model/
      repositories/
    contribution/
      components/
```

Keep route composition in `app/pages/`, and extend the existing `media` feature instead of
creating another media module. Expose narrow feature entry points rather than importing another
feature's internals. Reconcile older folder documentation as features land.

Extract components at first use; share only after reuse establishes a domain-neutral contract.
Avoid a generic table/chart framework or many mode flags.

| Owner              | Components                                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Application        | AppShell, SiteNavigation, SiteFooter, ThemeModeControl                                                                            |
| Shared when reused | PageIntro, EmptyState, ErrorState, StatCard, external-link treatment                                                              |
| Scoreboards        | ContestSelector, ContestHeader, SourceCallout, ProblemResultCell, ResultsLegend, TeamIdentity, SchoolIdentity                     |
| Scoreboards        | StandingsTable, StandingRow, MobileStandingCard, ScoreboardFilters, ActiveFilterChips, ShareViewAction, AccumulatedStandingsTable |
| Scoreboards        | SchoolSummaryCard, SchoolScopeBanner, SchoolStatistics, SchoolTrendChart, PodiumList, ParticipationSummary, SchoolResultsTable    |
| Media              | MediaEventHeader, PostCard, MediaCarousel, FeedSkeleton, FeedStatus                                                               |
| Contribution       | ContributionSteps, EvidenceRequirements, CorrectionCallout                                                                        |

Drawers, carousels, theme mode, and transient feedback use local React state. The theme preference
repository persists user selection; components never access storage. Scoreboard selection/filters
belong in URLs. Introduce Zustand, React Hook Form, or async-state tools only for their intended
responsibility, not merely because they are available.

## Milestones

### 0. Lock design and behavior contracts

**Dependencies:** none.

Record typography, palette, radii, spacing, shadows, dimensions, breakpoints, motion, and focus
in the design specification. Approve brand redistribution and the route/filter/media contracts
in product scope. Inventory all populated/loading/empty/error/recovery states.

**Exit:** durable specifications and fixed visual-reference scenarios exist; canonical mock data
remains unchanged. Complete.

### 1. Implement the visual foundation

**Dependencies:** 0.

Implement the single light/dark theme, semantic result tokens, locally served fonts, approved
brand assets, provider controls, reduced motion, and 320px reflow. Centralize numeric typography
and recurring design values. Persist user theme selection through its repository.

**Exit:** representative controls/statuses match the documented design, theme modes work,
contrast/focus/motion/reflow checks pass, and saved preference handling is verified.

### 2. Implement runtime repositories and domain selectors

**Dependencies:** 0; independent of visual UI work.

Add scoreboard/media contracts and validated JSON repositories. Discover the documented file
layout, keep mock and archive selection isolated, and exclude mock content from normal production
loading/bundling. Distinguish empty datasets, missing records, malformed records, and load errors.
Preserve file/record diagnostics rather than silently dropping corrupt records.

Add pure joins, catalog, scoring, first-solve, filter, and institutional history selectors.
Application composition can pass contest ids to media validation without cross-feature imports.
Retain existing CI validation from the same schemas.

**Exit:** repository tests cover real/mock isolation, empty archives, malformed data and references;
domain tests cover ties, penalty rules, hierarchy, and optional fields.

Complete. Scoreboard and media repositories expose explicit ready/empty/invalid/error results
and preserve file/record diagnostics without publishing partial data. Application composition
owns dataset selection and supplies contest ids to media; features do not import each other.
The production data-layer build excludes mock modules and executes against only the real
archive, which is currently empty. No competition data is loaded by the placeholder screen.

Selectors cover sparse catalogs, official placements, contest-specific scoring, every tied
first solver, AND filtering, unchanged accumulated scores, safe qualification cuts, transitive
institution rollups, season-scoped identities, and latest-held-contest media selection using
Mexico City dates. Runtime and CI share the added registry-season, standing-uniqueness and
post-reference checks.

Verification: `npm run validate` passed (81 tests across 13 files, 96.38% line coverage, 26 data
files validated, production build). `npm run test:e2e` passed all four existing workflows,
including the seven-size responsive matrix. With approval, stale placeholder test assertions
were aligned to the current Spanish screen; no screen behavior changed. Feature-screen
responsive verification remains part of each later UI milestone.

### 3. Add routing, shell, and contribution

**Dependencies:** 1.

Implement React Router paths from product scope, accessible navigation/drawer, theme toggle,
skip link/main landmark, footer, loading/error boundaries, page titles, and recovery.
Port the complete contribution guide with actual repository links, official evidence requirements,
and attempts/derived-value guidance matching CONTRIBUTING.md.

Keep unfinished features out of navigation. Retain the root placeholder until standings are
usable; do not release dead routes. Update architecture/folder docs and supersede the
placeholder-only ADR when replacing the root.

**Exit:** the first complete page works across viewports with valid links, navigation focus,
and persisted theme selection through the visible control.

Complete with the approved repository-link exception below. The shell and read-only contribution page are implemented. Only completed navigation is
exposed; the root stays a construction screen and unreleased paths show recovery. Shared
application configuration derives repository URLs. By user approval, `OWNER/REPOSITORY` remains
a provisional URL with explicit UI warnings until the actual GitHub destination is supplied;
the real-link availability criterion is deferred, not claimed verified.

Verification: `npm run validate` passed (95 tests across 14 files, 96.28% line coverage,
26 data files validated, production build). `npm run test:e2e` passed 13 workflows covering
keyboard/touch navigation, skip/main focus, drawer trapping/Escape/restoration, visible theme
persistence, route titles/recovery, delayed page loading, failed page chunks and successful retry.
The page component is lazy-loaded inside Suspense with a stable route boundary so a failed
import cannot leave the main region blank.

All three released route states passed document-overflow checks at seven specified sizes plus
600/900/1200/1536px breakpoint edges in both themes (114 route/size/theme combinations).
Axe passed on phone/desktop routes and the open landscape drawer; reduced motion, computed
focus outline, and 200% root-font enlargement also passed. Visual inspection covered desktop
light and phone dark. The 320px case verifies 400%-zoom-equivalent reflow; physical devices and
actual browser-toolbar zoom remain supplemental release checks, not claims of this milestone.

Validation exposed nondeterministic school/team ordering after parallel file loads. Repository
outputs now sort those identities, with a regression assertion. The production build passes
with a Vite size warning for the roughly 593kB minified entry (190kB gzip); the contribution page
is a separate lazy chunk. No warning threshold was relaxed.

### 4. Build scoreboard rendering primitives

**Dependencies:** 1, 2.

Implement ProblemResultCell for all statuses and tied first solves, plus identities, roster
absence, source, header, and legend. Reuse them across desktop rows/mobile cards.
Pass derived first-solve status explicitly instead of changing persisted records.

**Exit:** tests cover optional metadata, text/icon semantics, complete focus/hover descriptions,
problem ordering, and equivalent information without duplicated scoring logic.

**Completed:** result cells, ordered two-column grids, legend, team/roster and school identities,
source/correction callout, and contest header are exported from the scoreboard feature. Cells
consume derived first-solve flags, preserve ties, explain attempts including acceptance, and
expose complete descriptions on focus, hover, click, or touch. Missing optional metadata and
rosters remain explicit; logo failures are visible and diagnosed. Header fields follow the
contest model, and invented data never claims official provenance.

An isolated browser fixture composes table rows and cards from the same selectors/components;
no temporary application route was added. The root remains the construction screen until
milestone 5. Verified both themes at the seven standard sizes and all four breakpoint edges
(38 size/theme combinations), minimum 68 x 48px cells, contained scrolling/focus, equivalent
accessible descriptions, axe scans, keyboard disclosure, touch and outside dismissal, and 200%
root-font enlargement. Visual inspection covered desktop light and phone dark. Browser checks
caught and resolved unintended heading levels and unreliable quick-tap descriptions. Physical
devices and browser-toolbar zoom remain supplemental checks.

`npm run validate` passed with 114 unit tests and 96.61% line coverage; `npm run test:e2e`
passed all 18 tests. The existing roughly 593kB production-entry warning remains unchanged;
test fixture modules are not part of the shipping application.

### 5. Ship unfiltered contest standings

**Dependencies:** 2, 3, 4.

Compose repositories, data-driven selectors, provenance, metadata, desktop tables, mobile cards,
and correction actions. Match sticky offsets to actual column widths. Verify contained horizontal
scroll and focus visibility. Handle direct URLs, absent data/teams, sparse seasons, invalid
selection, and errors without fixed contest ids or season checks.

Redirect root to standings and replace placeholder tests only when this slice works.

**Exit:** users can inspect any archived mock contest, choose another, and reach its source and
contribution guide on desktop and phone.

**Completed:** the standings route composes validated archive loading, data-driven
season/series/contest selection, provenance, ordered desktop rows and phone cards. Root navigation
redirects to standings. Empty real archives, contests without teams, absent held contests,
invalid selections, and repository diagnostics have explicit states and recovery.
Browser journeys cover sparse seasons, series changes, source/correction actions, root entry,
and equivalent table/card results. Sticky identity cells use explicit column attributes so
mixed row-header/data cells retain correct offsets; dynamic titles use a single metadata string.
The production preview confirms the real archive's empty state without mock substitution.

### 6. Add URL filtering and sharing

**Dependencies:** 5.

Implement typed parameter parsing/serialization from product scope. Preserve AND combinations,
chips, counts, filtered badge, individual removal, and selection-preserving clear-all. Problem
selection scopes accepted/first predicates without hiding columns. Handle stale/invalid values
explicitly. Verify reload/history/share behavior without duplicating URL state.

Clipboard absence/rejection must show a usable way to obtain the URL; announce success only
after copying succeeds.

**Exit:** filter combinations, first-solve ties, empty matches, removal, back/forward, reload,
deep links, and clipboard failures are covered.

**Completed:** reusable filter controls, active chips, counts, a filtered badge, and sharing
compose around the existing filtering selector. Typed URL parsing rejects stale/repeated
values and invalid toggles with targeted removal actions; invalid filters never display
unrelated results. AND combinations preserve official places and whole-contest first-solve
ties, and selecting a problem never hides columns. Exact schools with no matching teams show
empty matches rather than institution rollups.

Filter edits replace history and clear-all preserves contest selection; explicit contest changes
push history and clear filters. Search-only changes reuse the validated loader result.
Synchronous URL edits avoid dropped parameters during rapid interactions without a second
filter store. Reload, deep links, and browser back/forward restore the same controls/results.
Share feedback follows successful clipboard writes only; missing/rejected clipboard access
opens a selectable manual-copy URL dialog, and URL edits clear stale success feedback.

`npm run validate` passed with 146 unit tests; `npm run test:e2e -- --workers=2` passed all
26 browser tests. Filtered standings passed both themes at the seven viewport sizes and
all breakpoint edges (38 size/theme combinations), phone/desktop axe scans, contained table
scrolling, aligned sticky columns, keyboard focus visibility, touch interactions, and 200%
root-font enlargement. Visual review covered desktop light and phone dark. These are browser
checks, not claims of physical-device or browser-toolbar zoom testing. The existing production
chunk-size warning remains; no warning/coverage threshold was relaxed.

### 7. Add accumulated standings

**Dependencies:** 5; independent of 6.

Select SeasonStanding by season/series/view. Render published scores, source, qualification text,
school identities, and supported cut indicators, without contest-only metadata/filters.
Enable school links with the history destinations in milestones 8/9, not dangling routes.

**Exit:** accumulated URLs round-trip, missing records recover explicitly, qualified-only rows
work, and no accumulation or unsupported qualification boundary is inferred.

**Completed:** distinct accumulated headers and desktop tables/phone cards reuse identities,
rosters, provenance, and sharing. They render stored scores at their published precision,
official places including ties, and explicit qualification text/icons with semantic surfaces.
A cut appears only between a qualified prefix and an entirely unqualified suffix with distinct
places; empty, qualified-only, all-unqualified, noncontiguous, and tied-boundary cases are covered.
No contest-only date, duration, penalty, problem metadata, legend, or filter controls are invented.

The shared season/series/classification picker discovers published accumulated records,
including standing-only seasons and open-ended series. Explicit group changes retain accumulated
mode where available and fall back to a contest only on that selection action. Direct malformed,
conflicting, repeated, incomplete, or missing-record URLs explain the problem and offer recovery.
Incompatible contest filters require explicit removal that preserves season/series/view.
Selection pushes history; reload, back/forward, and sharing reproduce the selected view.
School links are intentionally staged with their unreleased history destinations.

`npm run validate` passed with 186 unit tests and 93.92% line coverage; the full
`npm run test:e2e -- --workers=2 --reporter=line` suite passed all 31 tests. Accumulated
standings passed both themes at the seven standard sizes plus every breakpoint edge
(38 size/theme combinations), table/card data equivalence, document-overflow checks,
phone/desktop axe scans, keyboard scrolling, touch selection, and 200% root-font enlargement.
Visual inspection covered desktop light and phone dark. Physical-device and browser-toolbar
zoom checks remain supplemental. The existing production-entry size warning remains (about
542kB minified); warning and coverage thresholds are unchanged.

### 8. Add the school index

**Dependencies:** 2, 3, 4.

Build searchable responsive cards with scope-aware summaries, optional locations/logos, best
placement, and precise result counts. Distinguish no schools, no search matches, and no results.
Expose navigation only when card destinations work; release alongside milestone 9 if necessary.

**Exit:** search, zero-result schools, descendant aggregation, and optional identities work
without duplicate results.

### 9. Add school histories and charts

**Dependencies:** 8.

Compose scope banners, statistics, trends, podiums, participation, rosters, and contest links from
shared selectors. Recharts is the proposed chart dependency; check compatibility/accessibility
before adding it through npm in this milestone. Derive ranges/scales from data, reverse the place
axis, and provide exact keyboard-accessible values with text/table equivalents.

Handle empty, single-season, missing-roster, unknown-school, and standalone-school cases.
Accumulation is not another contest and must not inflate solved/participation totals.

**Exit:** index-to-school-to-contest journeys work, rollup/unit scope is correct, and charts
agree with accessible equivalents without clipping data.

### 10. Add repository-backed media

**Dependencies:** 2, 3; independent of scoreboard UI.

Select the eligible Event using product scope and display only referenced posts. Implement
event heading, responsive feed, metadata, optional title/assets, tags, carousel, and permalink.
Use accessible playback for playable videos or an honest original-post action.

Test loading/empty/unavailable/error with repository fixtures, not public state overrides.
Handle no eligible event, events without linked contests/location/posts, and optional author
details/media/tags. Never claim an API outage in repository-only mode.

Live integration requires a separate integration ADR, credentials/proxy strategy, and server-state
decision, reusing the same validated Post and presentation. No client secrets or premature
async-state dependency.

**Exit:** event selection, carousels, original links, and isolated failures work.

### 11. Complete cross-feature release verification

**Dependencies:** 6, 7, 9, 10.

Review every specified state in both themes and the responsive matrix. Verify cross-page links,
deep links, recovery, empty real archive, production mock exclusion, accessibility, media failures,
and actual zoom/touch behavior. Update README, architecture, folder, product, design, accessibility,
and testing docs to match delivered behavior.

**Exit:** all gates pass and accepted deviations have explicit review evidence.

## Verification gate for each milestone

- Use Node 24/npm 11. Restore dependencies with `npm ci` when necessary.
- Run focused checks first, then `npm run validate`; add `npm run test:e2e` for user workflows.
  Maintain existing coverage thresholds.
- Inject repositories/fixtures in tests. Use a separate explicit fixture build for browser journeys,
  and test the normal empty-archive production build as well.
- Keep fonts/clocks/viewports/images/animations deterministic; do not depend on social services.
- Run axe on critical routes plus manual keyboard/focus review. Screenshots supplement behavior,
  not replace it. Compare equivalent presentation inputs rather than rewriting canonical mock data.

### Responsive verification

Test affected routes/components in light/dark at:

| CSS viewport | Purpose                                      |
| ------------ | -------------------------------------------- |
| 320 x 568    | Minimum-width reflow and long-content stress |
| 390 x 844    | Portrait phone and touch                     |
| 844 x 390    | Landscape phone, limited height              |
| 768 x 1024   | Portrait tablet                              |
| 1024 x 768   | Landscape tablet                             |
| 1440 x 900   | Desktop                                      |
| 1920 x 1080  | Wide containment and readable lines          |

Check one pixel below/at/above every used breakpoint. Resize open pages without losing selection,
filters, carousel position, or navigation usability. Cover populated/loading/empty/error states.

Require no page overflow, clipped content, overlaps, or unreachable controls. Wide tables scroll
only in labeled containers; sticky headers/columns align, and mobile cards retain all information.
School/accumulated tables must also be navigable on phones. Charts/media fit without truncation
or unexpected shifts. Stress long names, many problems/chips, and absent optional content.

Test touch and keyboard with no hover-only actions. Check short viewports and reduced motion.
At 200% zoom keep controls/text usable; at 400% on a 1280px viewport verify 320-CSS-pixel reflow.
Restrict two-dimensional scrolling to intrinsically wide content.

Automate representative phone/tablet/desktop journeys, overflow assertions, and fixed screenshots.
Supplement emulation with manual touch, zoom, orientation, and resize checks. Record actual tested
sizes/outcomes rather than claiming responsiveness from screenshots alone.

### Minimum acceptance scenarios

| Layer          | Cases                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------- |
| Data           | Valid/invalid records, missing references, empty archive, dataset isolation                    |
| Scoring        | Varying duration/penalty, no solves, ties, all first solvers, official places                  |
| Selection      | Sparse seasons, unknown ids, invalid params, AND filters, reload/history                       |
| Standings      | Sticky scrolling, keyboard focus, mobile equivalence, absent metadata                          |
| Accumulation   | Published values, qualified-only rows, ambiguous boundaries                                    |
| Schools        | Descendants, units, standalone/empty schools, season identities, chart/table agreement         |
| Media          | Past/upcoming eligibility, event membership, all feed states, optional content, carousel/video |
| Cross-feature  | Navigation, contest links, contribution evidence, recovery, both themes                        |
| Responsiveness | Matrix, breakpoint edges, state retention, touch, scoped scroll, zoom, long content            |
