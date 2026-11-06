# ADR 0010: Load scoreboard seasons on demand

## Status

Accepted

## Decision

Generate a compact, schema-validated scoreboard catalog at build time. The scoreboard route loads
the shared school directory and only the selected season's teams, contests, and accumulated
standing. Search-only and same-season selection changes reuse that validated season; selecting a
different season loads that season through the same repository boundary.

School histories and media continue to load the full archive because their current selectors and
cross-feature reference validation require records from every season.

## Consequences

Initial scoreboard navigation avoids downloading standings for unrelated seasons, while retaining
the existing hash URLs and Zod validation. The catalog is generated from repository data and
contains no result rows. CI remains responsible for validating cross-season references globally;
runtime validates each selected season before displaying it.
