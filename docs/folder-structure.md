# Folder structure

```text
data/                      Competition and media data as JSON (see docs/data-model.md)
  mock/                    Seed dataset with invented results, validated separately
config/                    Non-secret operator configuration
scripts/                   Node-only CLIs run through npm scripts and GitHub Actions
  media-ingestion/         Juicer adapters and append-only ingestion
e2e/                       Playwright user journeys
public/
  logos/                   School logos served by path, referenced from data
src/
  app/
    components/            Application shell, navigation, footer, theme control, document
                           title and status page layout
    config.ts              Repository links and provisional configuration
    pages/                 Route-level or top-level screens
    providers/             Application-wide provider composition
    repositories/          Dataset selection and cross-feature data composition
    theme/                 Material UI theme and design tokens
    routes.tsx             Released route tree; pages are lazy-loaded through lazyPage
  components/              Reusable, domain-neutral UI
  features/                Domain schemas, selectors and repositories; UI added incrementally
  lib/                     Shared validation, JSON loading and date helpers
  test/                    Shared unit-test setup and utilities
```

`src/components/` is exported through the `@/components` barrel and holds layout and
presentation primitives shared by several screens and features: `PageContainer` (page padding),
`ListGrid` (unstyled responsive grid list), `DataList` (label/value `dl`), `AccentCard` (brand
accent card), `HeroBanner` (navy brand banner that opens every top-level page and school history),
`SectionTitle` (eyebrow plus heading), `TextLink` (underlined router link), `CardLink`
(stretched link that makes a whole card clickable and hoverable),
`ScrollRegion` (focusable scrollable region), and `DataLoadError`/`RetryButton` (validation-issue
alert with reload). Restyle them with `styled()` instead of copying their styles. Pages set
`<DocumentTitle>` from `src/app/components/`, which appends the site name.

Released screens are contest/accumulated standings, the school index and school histories, the
repository-backed media feed, the contribution guide, and route recovery in
`src/app/pages/`, composed within the application shell. Contribution-specific sections live in
`src/features/contribution/components/`. The data layer remains independent of screen composition.
Reusable scoreboard result cells/grids, team/school identities, roster disclosure, contest
header, provenance callout, and legend live in `src/features/scoreboards/components/` and are
exported through the feature entry point. `StandingsHeader` (breadcrumbs, title and provenance),
`StandingCard` (mobile standing row), and `QualificationChip` are shared by the contest,
accumulated, and school-history presentations. `ContestResults` composes URL filters, removable chips,
counts, sharing/recovery, and standings presentation. Pure parameter parsing/editing lives in the
scoreboard model; the application page owns scoreboard selection and loader-result presentation.
`ScoreboardSelector` discovers contest and accumulated choices; `AccumulatedHeader`,
`AccumulatedResults`, and `AccumulatedStandings` compose published-score presentation without
contest-only metadata or filters. Route-only result compositions are imported directly to retain
lazy loading rather than exporting them from the eagerly consumed feature entry point.
Their isolated browser composition lives under `src/test/fixtures/`, not `src/app/pages/`.

`SchoolsPage` composes URL search and repository states for `/schools`.
`SchoolHistoryPage` composes school scope and history for `/schools/:schoolId`; it uses the reusable `SchoolTrendChart` and
`SchoolHistoryResults` components. `SchoolSummaryCard` reuses `SchoolIdentity` with a heading
and a stretched card link; `SchoolLogo` renders a logo with an icon fallback;
the `schoolDirectory` and `schoolHistory` models derive scope-aware summaries and history metrics.
Route-only pieces are imported directly to keep the public entry point narrow. The shared
desktop/mobile navigation links to the index; cards and unit histories link to history pages.

`MediaPage` composes the latest held contest, eligible event, and referenced posts for `/media`.
`MediaPostCard` owns the accessible carousel, asset playback,
optional post metadata, and original-post link. The shared desktop/mobile navigation links to the
feed; media selection and validation remain in the repository/model layers.

The modules map to these features:

```text
src/features/
  scoreboards/   Contest standings, per-problem results, filters, school history
  media/         Curated posts linked to events for the latest held contest
  contribution/  Guide for correcting competition data through GitHub
```

Keep domain code in `src/features/<feature>/` using:

```text
components/   Feature-specific UI
model/        Domain schemas, inferred types and pure selectors
repositories/ Persistence contracts and implementations
index.ts      Narrow public entry point for application composition
```

Create code in the narrowest feature that owns it. Promote code to `components/` or shared
infrastructure only after it is genuinely domain-neutral and reused.
Route-level and cross-feature screen composition belongs in `src/app/pages/`, not inside
feature modules.

`data/` holds content rather than code, so it sits outside `src/`. Only a feature's repository
implementations parse its records; application composition discovers the appropriate dataset's
file loaders. Components never load data files directly.
