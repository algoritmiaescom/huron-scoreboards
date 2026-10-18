# ADR 0002: Use feature-oriented architecture

## Status

Accepted

## Decision

Organize domain behavior by feature while keeping application composition and generic UI
separate.

## Consequences

Feature ownership and dependencies remain visible. Features cannot import another feature's
internal modules; genuinely shared code is promoted deliberately.
