# ADR 0006: Persist the theme preference locally

## Status

Accepted

## Decision

Store the user's light/dark preference in localStorage through a typed repository owned by
application theming. Validate values with Zod, load before rendering themed children, and write
only when a user explicitly changes mode. Providers receive the repository through composition.

## Consequences

Preferences survive reloads in the same browser without a backend or account. Storage is
failable: report invalid/blocked reads and failed writes with diagnostics and a visible warning,
while allowing a temporary in-memory selection. Cross-tab synchronization is not required.

This decision applies only to a UI preference. Competition records remain repository-versioned
JSON under ADR 0005; it does not reinstate the superseded browser scoreboard persistence in
ADR 0003.
