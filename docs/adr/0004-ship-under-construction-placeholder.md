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

This supersedes ADR 0003. React Router, Zustand, React Hook Form, and Zod remain installed as the
agreed stack for that work, but are unused until feature development resumes.
