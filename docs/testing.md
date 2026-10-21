# Testing

## Unit and component tests

Vitest, Testing Library, and `user-event` cover domain boundaries and user behavior. Tests live
next to the code they exercise; shared setup lives in `src/test/`.

Coverage minimums are:

- 90% lines
- 80% functions
- 70% statements
- 50% branches

The React Compiler generates memoization code that v8 counts as uncovered statements and
branches, so line and function coverage are the meaningful gates. Raise these thresholds as real
application logic is added.

Run `npm run test:coverage` to enforce them.

## End-to-end tests

Playwright covers critical workflows in Chromium. The suite builds and previews the production
application automatically.

```sh
npx playwright install chromium
npm run test:e2e
```

Add an E2E test for a critical cross-page workflow, not for every component variation.

Scoreboard primitives are exercised independently through the isolated
`src/test/fixtures/scoreboard-primitives.html` entry. Playwright starts a second Vite server
on port 4175 for this fixture; application workflows still use the production preview on 4173.
The fixture is not an application route or a production build entry.

Its table and cards share derived rows and result components. Tests compare complete accessible
descriptions and arbitrary problem order, including tied first solves, rather than duplicating
scoring. Both themes cover the seven viewport sizes and all four breakpoint edges (38
size/theme combinations), cell minimum dimensions, document overflow, and phone/desktop axe
scans. Real-browser checks cover focus/hover descriptions, Escape and outside dismissal,
touch taps, keyboard roster disclosure, focus scrolling inside the table, and enlarged text.
Unit tests cover optional metadata, unavailable rosters, logo failures, semantic tokens,
provenance, dates, and source/correction actions.

The production archive-entry checks cover root redirection, the honest empty archive,
locally served fonts, the initial light palette,
saved-theme restoration, and document overflow across the implementation plan's seven viewport sizes. The shared tooling/E2E
TypeScript project includes DOM types because Playwright evaluations execute in the browser.
Theme unit tests cover both palettes, status contrast, and provider mode changes.
The scripts TypeScript project includes scripts and their transitive domain dependencies,
not all browser source files; browser code is checked by the application project.

The application-shell suite adds direct contribution links and titles, unknown-route recovery,
visible-control theme persistence, main-region focus, skip navigation, drawer focus trapping,
Escape/focus restoration, touch input, short-landscape use, and drawer state across breakpoint
changes. An intercepted lazy page chunk verifies error presentation and successful retry.

Each released route (`/`, `/contribute`, and unknown-route recovery) is checked in both themes
at the seven specified sizes and one pixel below/at/above 600, 900, 1200 and 1536px. Assertions
check document overflow; axe scans run at phone/desktop sizes and with an open mobile drawer.
Reduced motion, computed focus outline, and 200% root-font enlargement at a 640px viewport are
checked separately. The 320px matrix case covers 400%-zoom-equivalent reflow from 1280px;
this does not replace physical-device testing or a manual browser-toolbar zoom audit.

Repository URLs are checked against application configuration, not a live GitHub service.
The configured placeholder is explicitly disclosed; real destination availability cannot be
verified until the repository URL is supplied.

Standings workflows use the same port-4175 development server with `VITE_DATA_SOURCE=mock`
explicitly set; the port-4173 production preview still uses only real archive data.
Browser journeys verify sparse contest discovery, provenance/correction links, AND filters,
unchanged problem columns/places, counts, chips, clear-all, reload, back/forward, exact clipboard
contents, and selectable manual-copy recovery for absent/rejected clipboard APIs. External mock
logo requests are intercepted rather than depending on example services.

Filtered standings cover both themes at all seven viewport sizes and breakpoint edges,
table/card description equivalence, aligned sticky identity columns, focused-cell visibility,
200% root-font enlargement, touch toggles/chips, and phone/desktop axe scans. Matrix checks wait
for responsive layout changes before measuring overflow. Unit tests inject loader archives to
cover tied first solves, stale/repeated filters, empty matches/archives/teams, repository errors,
selection recovery, history semantics, single-load typing, and delayed clipboard success.

Accumulated browser journeys cover published fractional scores, qualification/cut placement,
provenance, contest/accumulated switching, missing-record and incompatible-filter recovery,
reload, history, and exact shared URLs. Both themes cover the seven sizes and breakpoint edges
(38 size/theme combinations), equivalent table/card data, no document overflow, phone/desktop
axe scans, keyboard scrolling, a touch-sized picker, and 200% root-font enlargement.
Unit/component tests cover standing-only seasons and open-ended series, malformed/conflicting
selection URLs, empty rows, qualified-only/all-unqualified/noncontiguous flags, and tied
qualification boundaries without invented cuts.

School index tests cover transitive institution rollups versus exact academic units, direct
parent results, distinct contest counts, zero-result/accumulated-only schools, and name/location
search with absent metadata. Injected loader tests cover empty real archives, repository
errors/invalid data, no matches, malformed queries, history, and single-load rapid input.
Browser journeys verify direct lazy loading, reloadable search, optional/failed logos, static
cards without dangling links, desktop/mobile index navigation with active state and drawer
closure/main focus, and production archive isolation. Both themes cover all seven
viewport sizes plus breakpoint edges (38 size/theme combinations), one/two/three-column reflow,
unchanged summary values, document overflow, phone/desktop axe scans, keyboard search,
touch recovery, and 200% root-font enlargement.

## Data validation

Competition and media data under `data/` is community-contributed, so it is checked like code.
`npm run validate:data` parses every data file with its Zod schema and verifies cross-file
references. See [data model](data-model.md) for the full check list.

Cover the validator itself with unit tests, including fixtures that are deliberately invalid: a
validator that never rejects anything passes silently and is worse than none.

Runtime repository tests exercise the actual development files as well as injected malformed
JSON, schema failures, load failures, broken references, missing records, and empty archives.
They verify dataset isolation and that a media failure leaves valid standings available.
The production-bundle test builds the data composition entry with the production environment,
checks that no mock modules were included, and executes the bundle to verify the currently
empty real archive without a mock fallback.
Development selection tests cover the unset default, explicit `mock`/`archive` values and
invalid configuration errors. Production-bundle tests verify that `mock`, `archive` and invalid
`VITE_DATA_SOURCE` values all leave production restricted to the real archive.

Pure selector tests cover contest-specific penalties, tied first solves before filtering,
official places, AND filters, sparse catalogs, published accumulated scores, safe qualification
cuts, transitive school scope, season-scoped teams, optional metadata, and ordered event posts.
Feed composition tests use the Mexico City date boundary and reject substitution of older,
future, or unlinked events. These are data-layer checks, not completed feature-screen E2E coverage.

## CI

Pull requests and pushes to `main` run validation and E2E jobs. Failed Playwright runs upload an
HTML report for diagnosis.

A separate `data` job runs `npm run validate:data` so a data-only contribution gets a clear,
fast result without waiting on the browser suite.
