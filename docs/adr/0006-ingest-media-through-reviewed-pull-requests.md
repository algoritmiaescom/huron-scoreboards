# ADR 0006: Ingest media through reviewed pull requests

## Status

Accepted. Supersedes only the external-media integration boundary in
[ADR 0005](0005-serve-repository-data-without-a-backend.md); its static-client, no-backend decision
remains in force.

## Decision

Collect public posts through Juicer in a Node script outside the browser. Support configured
Juicer feeds, direct hashtag lookup, or both, normalizing them into the media feature's existing
domain schema. Store snapshots as JSON under `data/media/events/`.

GitHub Actions runs the script manually or daily and proposes changes through one reviewed pull
request. Use a repository-scoped GitHub App installation token so the normal PR checks run.
Append new posts only; preserve archived posts and contributor edits.

## Consequences

No API credentials, external social requests, backend, or asynchronous server-state library enter
the browser. The future media repository reads validated archive data, not a live API with a
fallback. Ingestion failures leave the published archive unchanged.

Updates wait for review and merge, so this is not a real-time feed. Direct lookups are best-effort;
external media URLs may expire or disappear. Operators maintain Juicer connections, credentials,
and the ingestion configuration. Posts require attribution and review before publication.

See the [operator guide](../media-ingestion.md) for configuration and external setup.
