# ADR 0004: Ship an under-construction placeholder

## Status

Accepted

## Decision

Ship a single accessible "Under construction" screen and remove the exploratory scoreboard and
admin implementation, including its browser persistence, shared store, and related tests.

## Consequences

The repository keeps its full tooling, testing, accessibility, and CI baseline while presenting
an honest public placeholder. Scoreboard behavior must be rebuilt deliberately under the
documented architecture.

This supersedes ADR 0003. React Router, Zustand, React Hook Form, and Zod remain the agreed stack
for incremental feature work.

## Incremental delivery update

The application now wraps the root construction screen in a responsive shell and releases
`/contribute` with unknown-route recovery. The root placeholder remains in place until standings
are usable, so this decision is not yet superseded. React Router and Zod are now used; shared
stores and forms remain deferred.
