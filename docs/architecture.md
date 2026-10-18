# Architecture

## Runtime

The application uses React 19, TypeScript, Vite, and Material UI. React Compiler is enabled in
the Vite build.

`main.tsx` mounts the application providers. `App.tsx` renders the current screen. The
application currently ships a single "Under construction" placeholder and has no routing, domain
features, or persistence.

React Router, Zustand, React Hook Form, and Zod remain selected for upcoming feature work and are
installed, but they are intentionally unused while the placeholder is the only screen.

## Planned state ownership

When feature work begins:

- Local interaction state stays in React components.
- Form state belongs to React Hook Form and is validated with Zod.
- Shared client state belongs to a small feature-owned Zustand store.
- Navigation state belongs in routes and search parameters.
- Persisted data is accessed through a typed repository interface, never directly from
  components.

## Future server state

When a backend is introduced, add a remote repository implementation and an asynchronous state
tool such as TanStack Query. Do not use Zustand as a server cache. Record the backend and
deployment decisions in ADRs before coupling the application to them.

## Error policy

Invalid user input is shown in the interface. Invalid persisted data is surfaced explicitly
rather than silently replaced, so corruption can be diagnosed.
