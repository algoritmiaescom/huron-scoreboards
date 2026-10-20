# ADR 0005: Serve repository data without a backend

## Status

Accepted

## Decision

Ship the application as a static client with no backend service, database, or authentication.
Competition results are versioned in this repository, loaded as application data, and read
through a typed repository interface that returns validated domain objects. Corrections arrive as
pull requests rather than through an in-app authoring screen.

The initial media feed uses curated repository records behind its own boundary. Any future live
source is a separate, failable integration rather than a prerequisite for archive browsing.

## Consequences

The site can be served as static files, and there is no server, session, or role model to build
or operate. The repository interface keeps the storage format replaceable, so a remote source can
be introduced later without touching components.

Data is community-contributed, so it cannot be trusted: validate every record with Zod at the
repository boundary and surface invalid data explicitly. Because there is no server to reject bad
input, CI is the enforcement point — a GitHub Actions job validates `data/` on every pull request,
and correctness otherwise depends on review.

A failure in media data or a future external media source must degrade only its own page.

Which modules the site presents is a product question, defined in `docs/product-scope.md`, not in
this record.
