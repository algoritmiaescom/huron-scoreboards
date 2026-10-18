# ADR 0001: Use Material UI

## Status

Accepted

## Decision

Use Material UI with Emotion and one application theme for components, design tokens, and global
baseline styles.

## Consequences

The application gains an accessible component foundation and consistent theming. Feature code
must use theme tokens and should not introduce a parallel styling system. The styling and theming
conventions that follow from this are in [design](../design.md) and
[best practices](../best-practices.md).
