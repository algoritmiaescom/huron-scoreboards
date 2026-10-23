# Folder structure

```text
data/                      Competition and media data as JSON (see docs/data-model.md)
  mock/                    Seed dataset with invented results, validated separately
e2e/                       Playwright user journeys
public/
  logos/                   School logos served by path, referenced from data
src/
  app/
    components/            Application shell, navigation, footer and theme control
    config.ts              Repository links and provisional configuration
    pages/                 Route-level or top-level screens
    providers/             Application-wide provider composition
    repositories/          Dataset selection and cross-feature data composition
    theme/                 Material UI theme and design tokens
    routes.tsx             Released route tree and lazy page loading
  components/              Reusable, domain-neutral UI
  features/                Domain schemas, selectors and repositories; UI added incrementally
  lib/                     Shared validation, JSON loading and date helpers
  test/                    Shared unit-test setup and utilities
```

Released screens are contest/accumulated standings, the school index and school histories, the
repository-backed media feed, the contribution guide, and route recovery in
`src/app/pages/`, composed within the application shell. Contribution-specific sections live in
`src/features/contribution/components/`. The data layer remains independent of screen composition.
Reusable scoreboard result cells/grids, team/school identities, roster disclosure, contest
header, provenance callout, and legend live in `src/features/scoreboards/components/` and are
exported through the feature entry point. `ContestResults` composes URL filters, removable chips,
counts, sharing/recovery, and standings presentation. Pure parameter parsing/editing lives in the
scoreboard model; the application page owns scoreboard selection and loader-result presentation.
`ScoreboardSelector` discovers contest and accumulated choices; `AccumulatedHeader`,
`AccumulatedResults`, and `AccumulatedStandings` compose published-score presentation without
contest-only metadata or filters. Route-only result compositions are imported directly to retain
lazy loading rather than exporting them from the eagerly consumed feature entry point.
Their isolated browser composition lives under `src/test/fixtures/`, not `src/app/pages/`.

`SchoolsPage` composes URL search and repository states for `/schools`, loaded through
`LazySchoolsPage`. `SchoolHistoryPage` composes school scope and history for `/schools/:schoolId`,
loaded through `LazySchoolHistoryPage`; it uses the reusable `SchoolTrendChart` and
`SchoolHistoryResults` components. `SchoolSummaryCard` reuses `SchoolIdentity` with a heading;
the `schoolDirectory` and `schoolHistory` models derive scope-aware summaries and history metrics.
Route-only pieces are imported directly to keep the public entry point narrow. The shared
desktop/mobile navigation links to the index; cards and unit histories link to history pages.

`MediaPage` composes the latest held contest, eligible event, and referenced posts for `/media`,
loaded through `LazyMediaPage`. `MediaPostCard` owns the accessible carousel, asset playback,
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
