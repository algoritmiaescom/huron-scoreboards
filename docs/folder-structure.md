# Folder structure

```text
data/                      Competition and media data as JSON (see docs/data-model.md)
  mock/                    Seed dataset with invented results, validated separately
e2e/                       Playwright user journeys
src/
  app/
    pages/                 Route-level or top-level screens
    providers/             Application-wide provider composition
    theme/                 Material UI theme and design tokens
  components/              Reusable, domain-neutral UI
  features/                Domain features (added with feature work)
  test/                    Shared unit-test setup and utilities
```

The application currently contains only the placeholder screen in `src/app/pages/`.

The planned modules map to these features:

```text
src/features/
  scoreboards/   Contest standings, per-problem results, filters, school history
  media-feed/    Posts published under the latest contest hashtag
  contribution/  Guide for correcting competition data through GitHub
```

When feature work starts, create domain code in `src/features/<feature>/` using:

```text
components/   Feature-specific UI
model/        Domain schemas, types, and shared state
pages/        Route-level composition
repositories/ Persistence contracts and implementations
```

Create code in the narrowest feature that owns it. Promote code to `components/` or shared
infrastructure only after it is genuinely domain-neutral and reused.

`data/` holds content rather than code, so it sits outside `src/`. Only a feature's repository
implementations read it; components never load data files directly.
