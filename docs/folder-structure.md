# Folder structure

```text
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

When feature work starts, create domain code in `src/features/<feature>/` using:

```text
components/   Feature-specific UI
model/        Domain schemas, types, and shared state
pages/        Route-level composition
repositories/ Persistence contracts and implementations
```

Create code in the narrowest feature that owns it. Promote code to `components/` or shared
infrastructure only after it is genuinely domain-neutral and reused.
