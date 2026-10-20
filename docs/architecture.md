# Architecture

## Product goal

The application publishes historical standings of Mexican ICPC competitions, a media feed for the
latest contest, and a guide for correcting the data through GitHub. See
[Product scope](product-scope.md) for the full definition of the three modules.

## Runtime

The application uses React 19, TypeScript, Vite, and Material UI. React Compiler is enabled in
the Vite build.

`main.tsx` mounts the application providers. `App.tsx` renders the current screen. The
application currently ships a single "Under construction" placeholder and has no routing, domain
features, or competition persistence. Theme preferences are persisted separately.

React Router, Zustand, React Hook Form, and Zod remain selected for upcoming feature work and are
installed. Zod validates persisted theme preferences and competition schemas; routing, shared
stores, and forms are not needed by the placeholder.

## Theme preferences

Application providers own the active light/dark mode. A typed theme preference repository owns
localStorage access; components never read/write storage directly. It validates saved modes,
loads before rendering themed children, and writes only on user selection. Failures are logged
and shown as a warning while theme controls remain usable for the visit. See
[ADR 0006](adr/0006-persist-theme-preference.md) and [design](../DESIGN.md).

## Planned state ownership

When feature work begins:

- Local interaction state stays in React components.
- Form state belongs to React Hook Form and is validated with Zod.
- Shared client state belongs to a small feature-owned Zustand store.
- Navigation state belongs in routes and search parameters. Scoreboard filters (team, school,
  problem, accepted, first to solve) live in search parameters so filtered standings are
  shareable.
- Persisted data is accessed through a typed repository interface, never directly from
  components.

## Planned data flow

Competition data is versioned in this repository and shipped with the application. Features read
it through a repository interface that returns validated domain objects, so the underlying format
and future remote source stay replaceable. Validate every record with Zod at the repository
boundary; the data is community-contributed and must not be trusted.

The media feed reads public posts for the hashtag of the most recent contest. Treat it as an
external, failable source: the page must degrade to a clear empty or error state without breaking
the rest of the site.

## Future server state

When a backend is introduced, add a remote repository implementation and an asynchronous state
tool such as TanStack Query. Do not use Zustand as a server cache. Record the backend and
deployment decisions in ADRs before coupling the application to them; see
[ADR 0005](adr/0005-serve-repository-data-without-a-backend.md) for the current decision and
[adr/README.md](adr/README.md) for what qualifies as an ADR.

## Error policy

Invalid user input is shown in the interface. Invalid persisted data is surfaced explicitly
rather than silently replaced, so corruption can be diagnosed.
