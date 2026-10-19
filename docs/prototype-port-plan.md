# Prototype port plan

## Goal and constraints

Port the implemented [prototype](../prototype/src/) into the application incrementally,
preserving its Spanish-language experience, responsive styling, and working interactions while
adopting the application's architecture, coding standards, and validated data model.

This is an implementation plan, not authorization to replace the application in one change.
Each milestone should be a focused, reviewable change with its own acceptance evidence.

Agreed planning inputs:

- Development uses the existing [mock dataset](../data/mock/), not the prototype's generated
  fixtures. Mock results remain separate from the real archive and must never be published as
  competition history.
- Media starts with repository-backed events and posts. Preserve reusable loading, empty,
  unavailable, and error presentations; defer live social integration.
- The prototype is the visual and interaction reference. The application's
  [data model](data-model.md), schemas, [architecture](architecture.md), and
  [coding guidelines](best-practices.md) govern implementation.

Production must use the real archive and honest empty states while it remains empty. Do not
silently fall back to mock data. Tests may inject fixtures explicitly.

## What exists today

The application renders an under-construction screen. React Router and the selected state/form
libraries are installed; routing and runtime repositories are not implemented. Scoreboard and
media Zod schemas, cross-record validators, mock JSON, and validation tests already exist.

The prototype implements:

| Surface       | Behavior to retain                                                                        |
| ------------- | ----------------------------------------------------------------------------------------- |
| Shared layout | Responsive navigation/drawer, active links, light/dark toggle, branding, footer           |
| Scoreboards   | Season/series/contest selectors, provenance, desktop sticky table, mobile team cards      |
| Filters       | URL state, AND combinations, removable chips, counts, filtered badge, clear/share actions |
| Accumulation  | Published scores, explicit qualification labels, source, qualification cut indicator      |
| Schools       | Searchable institution/unit cards, locations, best placements, result counts              |
| School detail | Scope banner, statistics, trends, podiums, participation, rosters, contest links          |
| Media         | Event heading, post metadata, carousels, original links, simulated alternate feed states  |
| Contribution  | GitHub correction steps, evidence requirements, review expectations                       |
| Recovery      | Branded unknown-route and missing-school presentations                                    |

Important implementation differences:

- The prototype's scoreboard page is over 1,000 lines and mixes domain calculations, URL logic,
  styling, and rendering. Extract these responsibilities rather than copying the page intact.
- Prototype components use function declarations and `sx`; both are rejected by application
  lint rules. Use const arrow functions and module-scope MUI `styled()` components.
- The prototype uses MUI 7; the application uses MUI 9. Adapt to installed APIs rather than
  copying dependency versions, lockfiles, tooling, or configuration.
- The prototype's old [implementation plan](../prototype/plans/huron-scoreboards.md) describes
  superseded scaffold choices. Use the actual implementation and
  [design notes](../prototype/DESIGN_NOTES.md) as evidence, not those old technology assumptions.
- Recharts is used by the prototype but is not installed in the application. Address it when
  implementing school charts, not as part of a wholesale dependency import.
- The real archive is empty. Existing mock seasons intentionally cover more edge cases than
  the prototype and are the canonical development fixtures.

## Data-model adaptation

Create typed presentation selectors from validated domain records. Do not recreate the
prototype's parallel type system or store derived presentation fields in JSON.

| Prototype representation                            | Application adaptation                                                                                                           |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `School.name`, `parentId`, `kind`                   | Use `officialName` and `parentInstitutionId`; derive unit/rollup display from relationships without requiring a new `kind` field |
| Flattened team/school/roster on every row           | Join `StandingRow.teamId` to the season's `Team`, then `School`; preserve optional member roles and absent rosters               |
| `Problem.id` and keyed result object                | Use `Problem.label` and the corresponding ordered `results` entry                                                                |
| Stored `solved`, `penalty`, `firstToSolve`          | Derive solved count, contest-specific penalty, and all tied first solvers in the domain layer                                    |
| `Contest.season`, `officialUrl`, translated `stage` | Use `seasonYear`, `source`, and canonical stage values with Spanish display labels                                               |
| Accumulation as a fake `Contest`                    | Keep `SeasonStanding` separate; use a discriminated presentation selection for contest versus accumulated view                   |
| Accumulated contest id/date/problems                | Identify by season and series; derive a heading, not a fictitious contest, date, duration, or problem set                        |
| Fixed season/series arrays                          | Discover available seasons, series ids, contests, and accumulated standings from validated records                               |
| Flattened media author and title-case source        | Use `Post.author`, lowercase `source`, `postedAt`, `media`, and `tags`; format only for display                                  |
| Contest hashtag/location used by media              | Use media-owned `Event` metadata and `postIds`, with the optional loose `contestId`                                              |
| `?state=` simulates feed status                     | Drive runtime status from repository results; reproduce alternate states through test fixtures, not public simulation parameters |

Specific rules:

- Keep official places and accumulated scores unchanged, including ties. Never re-rank filtered
  rows or reconstruct accumulation from contest results.
- Compute penalty as the sum of `solvedAtMinute + penaltyMinutesPerFailedAttempt * (attempts - 1)`
  over solved results only. Attempts include the accepted submission.
- Derive first-to-solve from the entire unfiltered contest before applying filters.
- Resolve institution scope through parent relationships, including nested descendants; avoid
  double-counting and distinguish a unit, a standalone school, and an institutional rollup.
- Keep season-scoped team identities separate across years.
- Optional names, locations, logos, member roles, problem titles, author details, and media must
  render without broken links, missing-value strings, or fabricated facts.
- Contests do not currently store location or hashtag. Do not add fields just to satisfy
  prototype markup. Render only available metadata; media's event is its own source of metadata.
- There is no persisted Series registry. Keep ids open-ended, use display labels for known
  series and a readable fallback for others, and do not restrict navigation to two hard-coded ids.
- Missing stages do not prove a season is incomplete: some have fewer qualifiers legitimately.
  Describe available archived records without asserting that an optional contest must exist.
- A `SeasonStanding` may list only qualified teams or non-contiguous qualification states. Keep
  row labels authoritative; show a single cut line only when the published row ordering supports
  it, and explain when the archive does not establish a complete qualification boundary.

Any genuine schema change must update its inferred types, validation, relevant fixtures,
contribution guidance, and data-model documentation in the same milestone.

## Ownership and reusable component boundaries

Follow the existing feature-oriented structure:

```text
src/
  app/
    pages/                 Route-level screens and cross-feature composition
    providers/             Theme controls and repository composition
    theme/                 Prototype-derived semantic tokens and MUI overrides
    routes.tsx             Application route definitions
    components/            Application shell, navigation, footer
  components/              Domain-neutral components actually shared by features
  features/
    scoreboards/
      components/          Contest/standing/school UI
      model/               Existing schemas plus scoring, filters, history selectors
      repositories/        Contracts and validated JSON implementations
    media/                 Extend the existing feature; do not create a duplicate media-feed
      components/
      model/
      repositories/
    contribution/
      components/          Guide content and feature-specific correction actions
```

Use `src/app/pages/` for route composition in this port, rather than adding competing page
directories. Reconcile documentation that still calls the existing media feature `media-feed`.
Expose narrow feature entry points where cross-feature composition needs them; do not import
another feature's internals.

Extract components at their first real use, and share them when a second use establishes a
stable contract. Avoid a generic table/chart framework or a component with many mode flags.

| Owner                            | Candidate reusable components                                                                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Application                      | `AppShell`, `SiteNavigation`, `SiteFooter`, `ThemeModeControl`                                                                                  |
| Shared, after demonstrated reuse | `PageIntro`, `EmptyState`, `ErrorState`, `StatCard`, external-link treatment                                                                    |
| Scoreboards                      | `ContestSelector`, `ContestHeader`, `SourceCallout`, `ProblemResultCell`, `ResultsLegend`, `TeamIdentity`, `SchoolIdentity`                     |
| Scoreboards                      | `StandingsTable`, `StandingRow`, `MobileStandingCard`, `ScoreboardFilters`, `ActiveFilterChips`, `ShareViewAction`, `AccumulatedStandingsTable` |
| Scoreboards                      | `SchoolSummaryCard`, `SchoolScopeBanner`, `SchoolStatistics`, `SchoolTrendChart`, `PodiumList`, `ParticipationSummary`, `SchoolResultsTable`    |
| Media                            | `MediaEventHeader`, `PostCard`, `MediaCarousel`, `FeedSkeleton`, `FeedStatus`                                                                   |
| Contribution                     | `ContributionSteps`, `EvidenceRequirements`, `CorrectionCallout`                                                                                |

Keep data access behind feature-owned repositories. Reuse the existing schemas and reference
validators at the browser boundary; do not import Node filesystem scripts into the application.
Cross-dataset wiring belongs in application composition and can pass contest ids to validation
without making media import scoreboard internals.

State ownership remains local React state for drawers, carousels, theme mode, and transient
feedback; route/search parameters for scoreboard selection and filters. Do not introduce a
Zustand store, React Hook Form, or async-state library merely because it is installed. Add those
only when their intended responsibility actually exists. Theme persistence is not required by
the prototype; if added later it must go through an appropriate repository boundary.

## Incremental milestones

Dependencies are explicit; list order does not require unrelated work to wait.

### 0. Lock the parity checklist and fixture scenarios

**Depends on:** none.

- Inventory the actual screens and interactions above against the prototype in a browser.
  Capture reference screenshots for desktop/mobile and light/dark, including filtered, empty,
  accumulated, institution/unit, media, and recovery views.
- Record typography, spacing, radii, shadows, table dimensions/sticky offsets, breakpoints,
  decorative patterns, motion, and focus treatment. Resolve discrepancies between prose design
  notes and actual rendered values using the rendered prototype as the reference.
- Use equivalent fixed presentation inputs for visual comparisons. Do not expect application
  mock rows to match prototype-generated rows or change canonical mock data to force a match.
- Settle route/search contracts: retain the prototype's public page paths and
  `contest`, `team`, `school`, `problem`, `accepted`, and `first` parameter meanings where valid.
  Give accumulated views an explicit season/series/view selection, not a fake contest id.
- Define deterministic default selection when no contest is requested, invalid-selection
  recovery, team-search semantics, and school-link scope. Recommend latest archived held contest,
  explicit recovery for unknown ids, team-name search matching its label, and direct unit links
  with separate parent links.
- Define media event eligibility: latest held contest's available event, explicit handling when
  none exists, and no accidental replacement by an upcoming unlinked event. Include the mock
  dataset's future/announced event in the acceptance scenarios.
- Verify redistribution approval for existing brand assets before copying them into production
  assets. Preserve approved branding and fonts, with deterministic loading/fallbacks in tests.

**Exit:** visual references and an interaction checklist exist, and the selection/edge-case
contracts are recorded in the relevant design or product documentation before implementation.

### 1. Port the visual foundation

**Depends on:** 0.

- Adapt the prototype theme into `src/app/theme/`: light/dark palettes, semantic scoreboard
  statuses, Space Grotesk/IBM Plex Mono, shape, spacing, elevation, focus, gradients, and motion.
- Centralize recurring numeric/data typography and layout values instead of scattering literals
  through styled components. Preserve the rendered design rather than treating refactoring as
  a redesign.
- Add approved brand assets and theme controls through application providers.
- Honor reduced motion and reflow below the prototype's fixed 360px body minimum.
- Update [design](design.md), including its stale claim that brand assets do not exist.

**Exit:** both themes render representative controls/statuses faithfully; focus, contrast,
reduced motion, and narrow-screen layouts are checked without globally weakening lint rules.

### 2. Implement runtime data access and domain selectors

**Depends on:** 0; independent of 1.

- Add scoreboard and media repository contracts and JSON implementations using existing
  schemas and reference validators.
- Wire the development dataset explicitly to `data/mock/`; isolate archive selection so
  production neither merges nor silently falls back to mock data. Exclude mock content from
  normal production asset loading/bundling.
- Build file discovery for the documented dataset layout, including the empty real archive.
  Distinguish empty data, missing records, malformed data, and load errors.
- Add joins, contest catalog, solved/penalty/first-solve derivations, filter selectors, and
  institution/history aggregations as pure domain helpers. Return typed presentation data.
- Return diagnostic validation errors with file/record context and surface failures explicitly;
  never drop invalid records or turn an invalid dataset into a successful empty result.
- Verify existing CI validation remains unchanged in intent and uses the same schemas.

**Exit:** tested repositories load the existing mock data, reject invalid fixtures, keep dataset
references isolated, and handle the empty archive; scoring/ties/hierarchy helpers are tested.

### 3. Add routing, shell, and contribution guide

**Depends on:** 1.

- Implement the application shell and prototype page paths with React Router, accessible
  navigation/drawer, theme toggle, main landmark/skip link, footer, and recovery screen.
- Port contribution as the first complete route, using real repository links rather than
  `https://github.com` placeholders. Keep its data instructions consistent with
  [CONTRIBUTING.md](../CONTRIBUTING.md), including attempts and derived values.
- Keep unreleased features out of navigation. Retain the root placeholder until the scoreboard
  route is usable; do not publish empty feature routes merely to complete the menu.
- Add route error/loading boundaries, meaningful titles/headings, and navigation focus handling.
- Update architecture/folder documentation and supersede the placeholder-only ADR when the root
  is replaced, preserving the historical decision.

**Exit:** the first real page and shell work end-to-end on desktop and mobile, with no dead
navigation or misleading correction links.

### 4. Build the reusable scoreboard rendering primitives

**Depends on:** 1, 2.

- Implement `ProblemResultCell` for unattempted, attempted, solved, and tied first-solve states.
  Pass derived first-solve status explicitly; do not add it to persisted `ProblemResult`.
- Build team/school identity, optional-roster display, source treatment, contest header, and
  result legend, then use them in both table rows and mobile cards.
- Preserve text/icon distinctions, keyboard focus, complete hover/focus descriptions, problem
  order, numeric typography, and missing-metadata treatment.

**Exit:** component tests cover every result state and missing optional fields; table/card
primitives produce equivalent information without duplicating scoring logic.

### 5. Ship an unfiltered contest scoreboard vertical slice

**Depends on:** 2, 3, 4.

- Compose the repository, data-driven season/series/contest selectors, metadata, sources,
  desktop standings table, mobile cards, and correction callout.
- Preserve sticky place/team/school columns and table header. Verify actual rendered column
  widths and offsets, horizontal scrolling, focus visibility, and mobile problem grids.
- Support direct contest URLs, changing selectors, partial archives, no contests/teams, unknown
  selection, and invalid-data/error states without hard-coded default ids or season checks.
- Make `/` redirect to `/scoreboards`, expose scoreboard navigation, and replace placeholder
  tests once this slice works. Recovery always links to a released route.

**Exit:** a user can select and inspect any archived mock contest, reach its official source and
contribution guide, and use the same workflow on a narrow screen.

### 6. Add URL-backed filtering and sharing

**Depends on:** 5.

- Add typed parsing/serialization of team, school, problem, accepted, and first-solve filters.
  Define behavior for invalid/stale values instead of silently using another contest.
- Preserve AND semantics, active chips, counts, filtered-view badge, individual removal,
  clear-all retaining the selection, and selection changes clearing incompatible filters.
- Verify whether selecting a problem alone scopes result predicates or changes displayed
  columns; document the prototype-compatible behavior rather than inventing one.
- Preserve browser back/forward and reload behavior. Do not duplicate URL state in a store.
- Handle clipboard absence/rejection explicitly; only announce success after a successful copy,
  and provide a usable way to obtain the URL when copying fails.

**Exit:** combinations, first-solve ties, empty matches, filter removal, shared deep links,
history navigation, and clipboard failure are covered.

### 7. Add accumulated standings as a separate view

**Depends on:** 5; independent of 6.

- Extend selection to available `SeasonStanding` records and render their official scores,
  qualified labels, source, school links, and appropriately supported cut indication.
- Do not reuse contest-only metadata or filters where they have no meaning.
- Handle absent accumulated records and standings containing only advancing teams.

**Exit:** accumulated URLs round-trip and show published values without computed accumulation,
invented contest metadata, or unsupported qualification claims.

### 8. Port the school index

**Depends on:** 2, 3, 4.

- Add searchable school cards using derived scope-aware summaries, responsive layouts,
  optional locations/logos, best placement, and precisely labeled result counts.
- Distinguish no schools, no search matches, and schools with no contest results.
- Preserve school identities and institution/unit labels without requiring prototype-only fields.
- Expose school navigation only when the index and its links have usable destinations; release
  alongside milestone 9 if detail pages are not ready.

**Exit:** search and zero-result schools work, and institution summaries aggregate descendants
without counting one team-result twice.

### 9. Port school history and charts

**Depends on:** 8.

- Compose scope banner, statistics, best-place trend, podiums, participation, roster display,
  and linked contest results from shared selectors.
- Use Recharts as the proposed implementation matching the prototype, adding it through npm
  only in this milestone after checking current React/MUI compatibility and accessibility.
- Derive chart domains/scales from data rather than the prototype's fixed place range and
  saturated participation bars. Preserve the reversed placement axis and visual language.
- Provide keyboard-accessible exact values plus a text/table equivalent, and handle empty,
  single-season, missing-roster, unknown-school, and standalone-school cases.
- Keep best-placement/history calculations based on contest results; do not count accumulated
  standings as another contest or another set of solved problems.

**Exit:** index-to-school-to-contest journeys work; unit and institution scopes differ correctly;
charts agree with their accessible equivalents and do not clip larger placement values.

### 10. Port repository-backed media

**Depends on:** 2, 3; can proceed independently of scoreboard UI milestones.

- Resolve the selected eligible media `Event` and its referenced posts through the media
  repository, not scoreboard imports or a global unfiltered post array.
- Port event header, responsive feed, post card, author/source metadata, optional title/assets,
  tags, carousel controls, timestamps, and mandatory original permalink.
- Support actual image and video records appropriately. The prototype's video is only an image
  with an overlay; do not treat video URLs as image sources or introduce fake playback controls.
  Use accessible native playback for playable assets, or an honest original-post link.
- Preserve skeleton/empty/unavailable/error components and test them through repository
  fixtures. Repository-only mode must not claim that an unattempted live API was rate-limited.
- Cover no eligible event, an event without a contest/location/posts, missing optional author
  details, and post records with no media or tags.
- Make no token-bearing client requests and add no async-state dependency. A future live
  integration requires a separate integration ADR, credentials/proxy strategy, and server-state
  decision; it must reuse the same validated post contract and card.

**Exit:** latest-event selection is correct, carousels and original links work, and a media
failure is explicit and does not break other routes.

### 11. Finish cross-feature parity and release readiness

**Depends on:** 6, 7, 9, 10.

- Compare every checklist state against the prototype in both themes at fixed desktop/mobile
  viewports. Review intentional model/accessibility deviations explicitly.
- Verify all navigation, correction links, selection deep links, recovery paths, and empty real
  archive behavior together.
- Check keyboard-only operation, screen-reader announcements, contrast, reduced motion,
  table scrolling, chart equivalents, and image/video failures.
- Complete the responsive verification matrix below for every released route and its relevant
  loading, empty, error, and populated states, not just the default scoreboard.
- Verify a normal production build excludes mock records and public state-simulation controls.
- Update README and architecture, folder, design, product, accessibility, and testing documents
  where implementation has changed their statements.
- Keep the prototype as the reference during the port. Removal or archival is a separate
  decision, not a prerequisite for shipping.

**Exit:** all required interactions and visual states have review evidence, the quality gates
pass, and any accepted deviations are documented rather than silently dropping functionality.

## Verification for every milestone

- Follow Node 24/npm 11, the existing import/style/type rules, and repository tooling.
  Use `npm ci` when dependency restoration is necessary.
- Start with targeted unit/component checks, then run `npm run validate` before completion.
  For user-facing workflows, also run `npm run test:e2e`.
- Maintain current coverage thresholds; do not lower them to accommodate ported code.
- Test behavior through repository injection and existing test utilities. For Playwright's
  production-style preview, use an explicit fixture build separate from deployable production
  output, and additionally test the normal empty-archive build.
- Keep fixture clocks, fonts, viewports, images, and animations deterministic for visual
  comparisons. Do not depend on prototype stock-photo hosts or real social services in tests.
- Run axe on each released critical route and exercise manual keyboard/focus flows; automated
  checks alone do not establish parity.
- Attach before/after screenshots for changed views, using equivalent presentation fixtures.
  Domain tests separately prove that those views are computed correctly from canonical JSON.

### Responsive verification gate

Every user-facing milestone must verify its affected components and routes across these CSS
viewport sizes, in both light and dark themes:

| Viewport    | Purpose                                           |
| ----------- | ------------------------------------------------- |
| 320 x 568   | Minimum-width reflow and long-content stress      |
| 390 x 844   | Typical portrait phone and touch interactions     |
| 844 x 390   | Landscape phone and limited vertical space        |
| 768 x 1024  | Portrait tablet and intermediate layouts          |
| 1024 x 768  | Landscape tablet and navigation/table transitions |
| 1440 x 900  | Desktop reference layout                          |
| 1920 x 1080 | Wide-screen containment and readable line lengths |

Also check one CSS pixel below, at, and above each breakpoint actually used by the changed
components. Resize an already-open page across breakpoints: navigation, filters, carousel
position, selected contest, and results must remain usable without losing state.

Required checks:

- No document-level horizontal overflow, clipped content, overlapping controls, or unreachable
  actions. Wide data tables may scroll inside a labeled container, not widen the page.
- Desktop sticky columns and headers remain aligned; mobile team cards preserve all result
  information. School-history and accumulated tables remain navigable on narrow screens too.
- Navigation drawers, filters, chips, buttons, tooltips, and carousel controls work with touch
  and keyboard; essential information and actions never depend on hover alone.
- Charts, school-card grids, media columns, images, and videos resize within their containers
  without truncating data or introducing unexpected layout shifts.
- Long school/team names, many problem columns, multiple filter chips, and missing optional
  content do not break layout. Check all relevant loading, empty, error, and populated states.
- At 200% browser zoom, controls and text remain usable; at 400% on a 1280px-wide desktop
  viewport, verify reflow equivalent to 320 CSS pixels. Restrict two-dimensional scrolling to
  content that genuinely requires it, such as a data table.
- Check short viewports for sticky-header/drawer obstruction, and honor reduced motion during
  responsive transitions.

Automate representative phone/tablet/desktop journeys and document-overflow assertions with
Playwright, together with screenshots at fixed sizes. Supplement viewport emulation with manual
touch, zoom, orientation, and resize checks; screenshots alone do not prove responsiveness.
Record the tested sizes and outcomes with each milestone's acceptance evidence.

Minimum acceptance scenarios:

| Layer             | Required cases                                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Data boundary     | Valid/invalid records, missing references, empty archive, mock/archive isolation                                                   |
| Scoring           | Varying duration/penalty, no solves, unsolved problems, all tied first solvers, official tied places                               |
| Selection/filters | Sparse seasons, unknown ids/series, invalid params, AND combinations, reload/back/forward, unmodified official places              |
| Standings         | Wide-table sticky behavior, keyboard scrolling, mobile equivalence, absent problem titles/rosters                                  |
| Accumulation      | Published-only values, partial qualified-only rows, ambiguous cut boundaries                                                       |
| Schools           | Descendant rollup, unit-only scope, standalone/empty schools, season-scoped teams, chart/table agreement                           |
| Media             | Eligible past versus upcoming event, event post membership, empty/error/unavailable/loading, optional fields, image/video/carousel |
| Cross-feature     | Root/navigation, school-to-contest deep link, contribution evidence links, unknown routes, both themes, narrow screens             |
| Responsiveness    | Viewport matrix, breakpoint edges, resize/state retention, scoped scrolling, touch, zoom/reflow, long-content stress               |

## First implementation change

Start with milestone 0, then port the visual foundation in milestone 1. Build repositories and
domain selectors as the independent next foundation. Do not begin by copying a full prototype
page or replacing the working application wholesale.
