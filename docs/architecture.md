# Architecture

## Product goal

The application publishes historical standings of Mexican ICPC competitions, a media feed for the
latest contest, and a guide for correcting the data through GitHub. See
[Product scope](product-scope.md) for the full definition of the three modules.

## Runtime

The application uses React 19, TypeScript, Vite, and Material UI. React Compiler is enabled in
the Vite build.

`main.tsx` mounts application providers. `App.tsx` mounts React Router's browser router;
`src/app/routes.tsx` owns the released route tree. The root redirects to `/scoreboards`;
`/contribute` loads the contribution guide, and unmatched paths render recovery. The standings
page selects contest or accumulated results from URL parameters. The lazy `/schools` index and
`/schools/:schoolId` histories and the repository-backed `/media` feed are accessible through
desktop/mobile navigation.

The application shell owns navigation, responsive drawer state, the theme control, skip link,
one main landmark, and footer. Route transitions focus the main region and reset scroll.
The contribution, standings, school index, school history, and media routes load lazily; initial
and navigation loading states are announced.
Route error boundaries log diagnostics and provide reload/home recovery. Page titles are
rendered with React 19 document metadata. The document language is Spanish.

Application configuration in `src/app/config.ts` supplies repository URL, default branch, and
the provisional-link flag. Contribution/footer links share derived URLs. The user-approved
placeholder URL is clearly identified in the UI until a real repository is configured.

React Router and Zod are in use. Zustand and React Hook Form remain installed for future
shared client state and forms; neither is needed for navigation or the read-only guide.

## Theme preferences

Application providers own the active light/dark mode. A typed theme preference repository owns
localStorage access; components never read/write storage directly. It validates saved modes,
loads before rendering themed children, and writes only on user selection. Failures are logged
and shown as a warning while theme controls remain usable for the visit. See
[ADR 0006](adr/0006-persist-theme-preference.md) and [design](../DESIGN.md).

## State ownership

As feature work progresses:

- Local interaction state stays in React components.
- Form state belongs to React Hook Form and is validated with Zod.
- Shared client state belongs to a small feature-owned Zustand store.
- Navigation state belongs in routes and search parameters. Scoreboard filters (team, school,
  problem, accepted, first to solve) live in search parameters so filtered standings are
  shareable. Filter edits replace history; scoreboard selection pushes an entry and clears filters.
  Search-only standings navigation reuses the validated loader result. URL-backed input edits
  commit synchronously through the router provider's React DOM `flushSync` integration so rapid edits do not overwrite
  one another with stale parameters. No separate filter store is maintained.
- Persisted data is accessed through a typed repository interface, never directly from
  components.

## Repository data flow

Competition data is versioned in this repository and shipped with the application. Features read
it through a repository interface that returns validated domain objects, so the underlying format
and future remote source stay replaceable. Validate every record with Zod at the repository
boundary; the data is community-contributed and must not be trusted.

`src/app/repositories/applicationData.ts` composes the feature repositories through their public
entry points. Development defaults to `data/mock/`; `VITE_DATA_SOURCE=archive` selects the real
archive instead (`mock` selects invented data explicitly). Invalid development values fail
explicitly on repository initialization. Production ignores this variable and discovers only
the real archive.
The development file module is behind a build-time development branch, and the production glob
excludes mock files. No runtime fallback substitutes invented records. Both the production bundle
boundary and the production standings route are tested against the real archive's empty state.

Repository `load()` results distinguish `ready`, `empty`, `invalid`, and `error`. Invalid and
failed loads retain file/record diagnostics and expose no partial dataset. Explicit record
lookups return `found` or `not-found`. Both CI and runtime use the same Zod schemas and
browser-safe reference validators; only CI checks local logo files on disk.

The application loads scoreboards first and supplies their contest ids to media validation,
without a media-to-scoreboards import. Invalid scoreboards block media validation explicitly;
invalid media does not discard valid standings. Media currently loads curated event/post files,
not a live service. A future external integration must preserve the same isolated failure behavior.
The media route defaults to the latest held contest and accepts `?contest=<id>` for a previous
held contest. Its picker is derived from validated event records and includes only contests whose
selected eligible event has referenced posts. Contest selection lives in the URL; invalid,
future, and repeated values produce an explicit recovery message instead of changing the feed.

Pure scoreboard selectors own catalog discovery, identity joins, contest-specific scoring,
tied first solves, AND filters, published accumulated results, qualification cuts, and
school/institution history. Filters never change official places or recompute first solve from
filtered rows. Accumulated scores remain separate from contest scores.

The standings loader logs repository errors; route composition handles archive/selection states.
Typed filter parsing explains repeated, stale, and malformed values before standings render.
The result selector supplies the same joined/scored rows to desktop tables and phone cards.
Clipboard feedback and the manual-copy dialog are local interaction state, keyed to the URL so
success for a previous view cannot be mistaken for success for the current one.

The school directory derives summaries from existing school-history selectors: parentless
records roll up transitive descendants, while academic units retain exact-school scope.
Team-contest rows, distinct contests, and best published contest place are separate metrics;
accumulated results do not contribute. Summaries are memoized from the loader result, not
recalculated for every keystroke. The index stores search in `q`, reuses synchronous URL edits
and search-only loader reuse, and keeps data access behind the existing validated repository.
Reusable school cards and search/summary helpers remain within the scoreboard feature; the
application page composes archive diagnostics, empty states and URL-backed search.

School history pages use the same validated scoreboard archive and school-history selector.
Their presentation model recomputes trend/statistical seasons from contest rows only and exposes
accumulated standings separately. The archive loader memoizes its in-flight/resolved result for
route transitions because the repository data is immutable for the lifetime of the loaded app.

Typed scoreboard selection distinguishes a contest id from a season/series/accumulated view.
The picker discovers both contest and standing-only catalog entries. Accumulated composition
reuses identities, provenance, and sharing but has a separate header and table/card renderer:
it consumes stored scores/qualification and selector-supported cut boundaries without contest
scoring or filters. Incompatible filter parameters require explicit, selection-preserving removal.

Default feed composition chooses the latest held contest, then the latest eligible event for
that contest. The caller supplies the current instant; selection uses its calendar date in
`America/Mexico_City` with ascending ids breaking equal-date ties. No eligible event means an
empty feed, not a different contest's posts. The `/media` route loads validated event/post records,
shows only explicitly linked posts, and distinguishes empty and repository error states. It does
not query social networks live.

## Future server state

When a backend is introduced, add a remote repository implementation and an asynchronous state
tool such as TanStack Query. Do not use Zustand as a server cache. Record the backend and
deployment decisions in ADRs before coupling the application to them; see
[ADR 0005](adr/0005-serve-repository-data-without-a-backend.md) for the current decision and
[adr/README.md](adr/README.md) for what qualifies as an ADR.

## Error policy

Invalid user input is shown in the interface. Invalid persisted data is surfaced explicitly
rather than silently replaced, so corruption can be diagnosed.
