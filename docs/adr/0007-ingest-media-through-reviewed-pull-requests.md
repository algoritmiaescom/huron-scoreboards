# ADR 0007: Ingest media through reviewed pull requests

## Status

Accepted. Supersedes only the external-media integration boundary in
[ADR 0005](0005-serve-repository-data-without-a-backend.md); its static-client, no-backend decision
remains in force.

## Decision

Collect public posts through Juicer in a Node script outside the browser. Support configured
Juicer feeds, direct hashtag lookup, or both, normalizing them into the media feature's existing
domain schema. Store snapshots as JSON under `data/media/events/`.

GitHub Actions runs the script manually or daily and proposes changes through one reviewed pull
request. Use the built-in repository `GITHUB_TOKEN` for branch writes and pull requests, granting
contents, pull requests, and Actions write permissions only to the ingestion job. After creating
or updating its PR, explicitly dispatch the existing CI workflow on the automation branch.
CI supports manual dispatch and retains read-only permissions. Append new posts only; preserve
archived posts and contributor edits.

## Consequences

No API credentials, external social requests, backend, or asynchronous server-state library enter
the browser. The future media repository reads validated archive data, not a live API with a
fallback. Ingestion failures leave the published archive unchanged. The one exception is a Juicer
credit rejection (HTTP 402): those queries are skipped with a warning and listed in the PR, so an
exhausted credit balance for direct lookups does not block feed collection. Append-only updates
can collect the skipped posts in a later run, while Juicer still returns them.

Updates wait for review and merge, so this is not a real-time feed. Direct lookups are best-effort;
external media URLs may expire or disappear. Operators maintain Juicer connections, credentials,
and the ingestion configuration. Posts require attribution and review before publication.

No GitHub App, private key, or personal access token is required. Repository/organization policy
must allow Actions to create PRs. Token-generated push/PR events do not trigger CI, but explicit
`workflow_dispatch` events do.

Dispatched CI checks the branch head, not the synthetic PR merge commit. New commits require new
checks, and branch-protection compatibility must be verified during rollout. A dispatch failure
fails ingestion after publishing; a maintainer can manually run CI on the automation branch.
No-change ingestion runs do not create redundant CI runs.

See the [operator guide](../media-ingestion.md) for configuration and external setup.
