# Media ingestion

The site stays static. A Node script reads Juicer and appends validated posts to real event JSON;
GitHub Actions proposes those files through a reviewed PR. No token belongs in browser code.
See [ADR 0007](adr/0007-ingest-media-through-reviewed-pull-requests.md).

## External setup checklist

### 1. Juicer account and permanent key

- Use a club-controlled Juicer account. Confirm API entitlement, pricing, quotas, and coverage
  for the desired platforms and both source modes. Review Juicer/platform retention and
  redistribution terms before publishing external posts in Git history.
- In the [Juicer dashboard](https://www.juicer.io/feeds), open **Developer** and generate a
  permanent API key. Do not use the temporary keys issued by `/v1/authorize` for scheduled jobs.
- For feed mode, create a feed, add sources for the event hashtag, complete any required social
  account OAuth connections, and configure moderation in Juicer. Record the numeric API feed ID.
  Only public posts are imported.
- Direct hashtag mode does not require a feed. Select supported platforms and confirm their
  availability in your account. It searches the event hashtag or a configured list of hashtags.
  Results are best-effort and are not moderated by the feed's rules.
- Store the permanent key as the repository Actions secret **`JUICER_API_KEY`**.

See [Juicer authentication](https://juicer.mintlify.app/authentication.md). Never put the key in
configuration JSON, a `VITE_` environment variable, logs, commits, or workflow inputs.

### 2. Built-in GitHub authentication

No GitHub App or personal access token is needed. GitHub supplies `GITHUB_TOKEN` automatically
for each run; do not create a secret with that name. The ingestion job requests:

- **Contents: write** for the automation branch and commits.
- **Pull requests: write** for creating/updating the data PR.
- **Actions: write** to dispatch CI on that branch.

Under **Settings > Actions > General > Workflow permissions**, enable **Allow GitHub Actions to
create and approve pull requests**. The workflow only creates/updates PRs; it never approves or
auto-merges them. If the setting is disabled by organization policy, an organization administrator
must allow it. Organization policy must also permit the requested token permissions.

The repository's default token permissions can remain read-only: the ingestion job explicitly
requests its writes, while CI retains read-only access. No GitHub credential needs manual rotation.
If migrating from the earlier App-based setup, remove the unused App Client ID/private-key
configuration and revoke any app key/installation dedicated solely to this integration.

### 3. Repository settings

Under **Settings > Secrets and variables > Actions**, configure:

| Kind     | Name                               | Value                          |
| -------- | ---------------------------------- | ------------------------------ |
| Secret   | `JUICER_API_KEY`                   | Permanent Juicer key           |
| Variable | `MEDIA_INGESTION_SCHEDULE_ENABLED` | Leave unset until rollout ends |

Organization-level secrets/variables must explicitly allow this repository. Enable Actions and
allow the pinned actions. Keep branch protection, reviews, and required checks; do not grant
default-branch bypass permissions. Token-generated push/PR events do not start CI automatically.
After publishing a PR update, ingestion explicitly dispatches `ci.yml` on the automation branch.
GitHub permits `workflow_dispatch` events generated using `GITHUB_TOKEN` to start workflows.

Only trusted default-branch manual/scheduled jobs receive credentials. Do not move this workflow
to `pull_request_target` or run secret-bearing steps on untrusted PR code.

## Configure a real event

The shipped configuration has no events: setup must not fabricate real competition records or
promote mock data. An empty configuration fails explicitly without requesting Juicer.

Create `data/media/events/<event-id>.json` with accurate real event metadata:

```json
{
  "event": {
    "id": "your-real-event",
    "name": "Actual event name",
    "date": "2026-10-22",
    "hashtag": "#ActualEventHashtag",
    "postIds": []
  },
  "posts": []
}
```

The values above illustrate the shape; replace them with verified event details. Omit `contestId`
until the corresponding real contest exists. Never target `data/mock/`.
The media page can show an unlinked or upcoming event as soon as it has published posts; no
scoreboard placeholder or altered event date is needed. Only posts with `postedAt` at or before
the current instant appear.

Edit `config/media-ingestion.json`:

```json
{
  "events": [
    {
      "eventId": "your-real-event",
      "sources": [
        { "type": "feed", "feedId": 123, "platforms": ["x", "instagram"] },
        { "type": "hashtag", "platforms": ["x", "youtube"] },
        { "type": "hashtag", "platforms": ["instagram"], "hashtags": ["#GPM2026", "#ICPCMexico"] }
      ],
      "startingAt": "2026-10-20T00:00:00-06:00",
      "endingAt": "2026-10-25T23:59:59-06:00",
      "suppressedPermalinks": []
    }
  ],
  "requestTimeoutMs": 30000,
  "retries": 2,
  "maxPages": 20,
  "maxRequests": 100
}
```

Replace the sample feed ID and event. Use either source type or both. Supported domain platforms
are `x`, `instagram`, `facebook`, `youtube`, and `linkedin`. Feed platform filters are optional;
an unfiltered feed containing unsupported platforms fails explicitly. A hashtag source searches
the event record's hashtag unless it lists its own `hashtags`, which replace it; include the event
hashtag in that list to keep searching it. Each hashtag is queried on each of the source's
platforms, and a post matching several hashtags is imported once. Associate each configured feed
with the intended event in Juicer; a feed's public posts need not all contain a hashtag in their
text.

For individual feed sources, use `"sourceIds": [12345, 67890]` instead of `platforms`.
These are Juicer source IDs, not social-post IDs. The two filter forms are mutually exclusive
because Juicer's `filter` parameter matches a list of sources rather than intersecting filters.

Date bounds are optional and inclusive in local filtering. Feed requests also pass the bounds to
Juicer, whose endpoint documents them as after/before filters. Direct mode filters locally:
it does not assume date-query support or stop pagination early. `maxPages` applies per
source/platform/hashtag; `maxRequests` includes retries across the entire run. Hitting a limit
stops that query with a warning and retains its fully validated pages for a partial import.
Narrow sources or increase limits deliberately.
The checked-in configuration allows 100 pages per query and 500 requests per run to accommodate
the broader `#ICPCMexico` search. These are still safety limits, not a guarantee of completion;
direct hashtag requests spend Juicer credits, including requests for posts later filtered locally.
Retries apply only to network/timeouts, 429, and 5xx. A `Retry-After` exceeding 60 seconds
stops the query for a later run instead of exceeding the job budget.

## Run locally

The Node-only `JuicerClient` class in `scripts/media-ingestion/juicer.ts` uses a dedicated Axios
instance. It accepts request timeout, retry, page, and lifetime request budgets independently of
event configuration, so one instance can collect multiple sources. Create a new instance for a new
ingestion run to reset its request budget. Tests inject an Axios adapter and retry sleep function;
they exercise the real Axios request configuration without contacting Juicer.
Direct client calls remain strict unless they provide an `onIncomplete` reporter; the ingestion
script always supplies one to retain validated partial results.

Use Node 24, npm 11, and `npm ci`. Copy `.env.example` to the ignored `.env` and set
`JUICER_API_KEY`. Node scripts under `scripts/` load the repository-root `.env` automatically when
it exists; variables already set in the environment, such as CI secrets, take precedence.

```sh
cp .env.example .env
npm run ingest:media -- --dry-run
npm run ingest:media
npm run ingest:media -- --config config/media-ingestion.json --dry-run
npm run ingest:media -- --dry-run --verbose
npm run validate:data
```

Dry-run collects and validates but changes nothing. Both modes print enabled source modes and
per-event counts for fetched, added, duplicate, suppressed, date-excluded, and newly imported missing-alt media items. Credentials
and raw response bodies are not logged. Juicer query failures (HTTP/network errors, HTTP-200
platform errors, malformed pages, missing required fields, repeated cursors, and exhausted
limits) produce warnings and partial summaries rather than failing the whole run.
Only fully validated pages are retained; data from failed or inconsistent pages is not imported.

### Troubleshooting

Errors are prefixed with the failing query, for example
`[event 2026-mexico-finals, hashtag #ICPCMX2026, platform x, page 1]`, followed by the HTTP
status, Juicer's error code and message, and a hint. Only Juicer's structured error fields are
shown; other response bodies are never printed. Pass `--verbose` to print one line per request
attempt, with its path, query parameters, status, and duration. Credentials are never printed and
pagination cursors are masked.

| Error                              | Likely cause and fix                                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `HTTP 401`                         | `JUICER_API_KEY` is missing or invalid; use a permanent dashboard key.                                    |
| `HTTP 402 insufficient_credits`    | Direct hashtag search spends Data API credits per request. Top up, or rely on feed sources.               |
| `HTTP 404`                         | `feedId` must be the numeric feed ID from the API, not the feed slug shown in the dashboard URL.          |
| `platform failure (fetch_timeout)` | Juicer could not reach the platform in time; usually transient, so rerun later.                           |
| `page limit reached`               | Narrow hashtags/platforms or raise `maxPages`. `startingAt` reduces feed results, not hashtag pagination. |
| `unsupported platform "…"`         | An unfiltered feed contains a platform the archive does not model; filter with `platforms`/`sourceIds`.   |

After a query fails, ingestion keeps its fully validated pages and continues other queries.
Every incomplete query is listed in the event summary's `incomplete` field with its reason,
page, and retained-post count (before deduplication and date filtering); queries retaining no posts
also appear in `skipped`. The CLI labels partial collections explicitly, and these summaries appear
in the PR description. Warnings also appear as GitHub Actions run annotations.
After HTTP 402, later queries of the same source type are skipped without spending requests.
Once the shared request budget is exhausted, later queries cannot make requests.
Because ingestion is append-only, a later run can collect missing posts if Juicer still returns them.
No retry cursor is persisted, so a rerun starts each query from the beginning.

All configured events are loaded before requests; all proposed changes are validated before
writing. Configuration, missing/invalid credentials at setup, archive validation, filesystem, and
GitHub publication errors still fail the job; partial collection never bypasses these safeguards.
Each changed file is formatted and replaced atomically. A filesystem failure during
multi-file replacement can leave some local files updated: inspect the diff and rerun. No failed
workflow publishes a commit/PR. Concurrent edits detected before staging fail instead of being
overwritten.

## Archive behavior

- Existing records, order, and contributor edits are preserved. Only new posts are appended,
  ordered by publication timestamp then stable ID. Repeating unchanged inputs creates no diff.
- IDs include event, platform, and a SHA-256 digest of the upstream platform identity, falling
  back to the canonical permalink. Feed-local Juicer IDs are not used.
- Duplicates are matched by ID or canonical permalink, including curated records with manual IDs.
  Canonicalization removes common tracking parameters and unifies Twitter/X hostnames. The same
  social post can appear under different event-scoped IDs without violating global uniqueness.
- Images/videos retain genuine upstream alt text. Missing/null alt becomes `""`; it is not
  fabricated. Empty storage descriptions do not imply decorative images, and accessible
  rendering must be addressed when the UI is implemented.
- Juicer link attachments are not image/video media and are omitted; the post's message and
  permalink remain. The importer never treats article URLs as image URLs, renders HTML, or
  downloads binaries. Remote media URLs can expire.
- Null or blank Juicer messages become `body: ""` for posts containing images or videos;
  their media and attribution are preserved, and the UI omits the empty body text block.
  Posts with neither nonblank text nor image/video media fail validation.
- No invented body, author, timestamp, or attribution fills missing required fields. Such
  records stop that query with an explicit warning and must be investigated.
- Existing posts are never refreshed or automatically removed when upstream data disappears.

To remove or reject a post, add its permalink to the event's `suppressedPermalinks` and manually
remove the archived post and its `postIds` entry if already present. Suppression prevents future
re-import; it does not delete existing content. Consider whether historical Git copies also need
removal for the applicable request. Manual corrections follow the normal contribution workflow.

## Automation and rollout

1. Merge the configured real event and both workflows onto the default branch. CI must include
   `workflow_dispatch` before ingestion can dispatch it.
2. Run a local dry-run and confirm authentication, source relevance, and both enabled modes.
3. Manually run **Actions > Ingest media > Run workflow** on the default branch.
4. Review the resulting `automation/media-ingestion` PR. Verify the dispatched validation, data,
   and E2E checks run on its latest commit and satisfy required checks; do not bypass missing checks.
5. Edit a description on the open data PR and rerun with a new upstream post. Confirm the edit
   survives. Repeat with unchanged input to verify no duplicates or unnecessary commits.
6. Set **`MEDIA_INGESTION_SCHEDULE_ENABLED=true`**. The daily cron is **12:17 UTC**. GitHub can
   delay scheduled runs; this is not a real-time service.

Runs are serialized. The workflow's branch and PR steps are implemented in
`scripts/media-pull-request.ts` (`npm run media:pull-request -- prepare|publish`), not inline in
the YAML. `prepare` reuses or validates the automation branch; `publish` commits, pushes, opens or
updates the PR, and dispatches CI. Failures are reported as GitHub Actions error annotations.
Existing PR changes must be limited to configured real event files. The workflow merges that data branch into the trusted default-branch checkout before ingestion, so
curator edits are retained without executing branch-supplied code. Conflicts and unrelated PR
changes require manual resolution. Pushes are never forced; a concurrent remote edit fails.
When no media changes relative to the existing PR are found, no commit/PR update is made.
No-change runs do not dispatch redundant CI runs.

CI can also be started manually through **Actions > CI > Run workflow**, selecting
`automation/media-ingestion`, or with:

```sh
gh workflow run ci.yml --ref automation/media-ingestion
```

Dispatched CI checks the selected branch head, not the synthetic PR merge commit. Every new
commit needs fresh checks. Confirm results appear on the latest PR commit and are accepted by
branch protection during rollout. Human pushes still trigger normal PR CI.

If CI dispatch fails, ingestion fails explicitly even though its branch/PR was already published.
Retry CI manually using the instructions above; rerunning unchanged ingestion will not dispatch
it again. CI failures are reported by the separate CI run, not by the already-finished ingestion job.

After merging (especially squash-merging) or closing an ingestion PR, delete its automation
branch before the next run. An unmerged leftover branch without an open PR blocks ingestion
rather than risking loss or accidental resurrection of rejected records. If branch push succeeds
but PR creation fails, open the PR manually or resolve the leftover branch before retrying.

The PR includes ingestion counts for review, not raw payloads. It never auto-merges. Failed
ingestion leaves the merged archive unchanged. Assign maintainers for failed-run notifications,
Juicer billing/connections, and repository Actions settings. Public-repo schedules may be disabled after
prolonged inactivity; re-enable the workflow in Actions when needed.

For credential rotation, replace the affected secret, verify a manual run, then revoke the old
Juicer key. For emergency shutdown, disable the workflow and revoke the Juicer credential if
necessary. Never send secrets through chat or commit them.
