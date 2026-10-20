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

Released screens are the root construction screen, contribution guide, and route recovery in
`src/app/pages/`, composed within the application shell. Contribution-specific sections live in
`src/features/contribution/components/`. The data layer remains independent of screen composition.

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
