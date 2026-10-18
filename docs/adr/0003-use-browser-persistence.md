# ADR 0003: Use browser persistence initially

## Status

Superseded by [ADR 0004](0004-ship-under-construction-placeholder.md)

## Decision

Persist the initial scoreboard through a typed repository backed by browser storage. Defer
asynchronous state tooling until a backend exists.

## Consequences

The first version works without backend infrastructure but does not synchronize across devices.
The repository boundary allows a future remote implementation without coupling components to
storage.

The scoreboard implementation that used this decision was removed with ADR 0004. The guidance
still applies when scoreboard persistence is rebuilt.
