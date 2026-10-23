# Media ingestion

The site stays static. A Node script reads Juicer and appends validated posts to real event JSON;
GitHub Actions proposes those files through a reviewed PR. No token belongs in browser code.
See [ADR 0006](adr/0006-ingest-media-through-reviewed-pull-requests.md).

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
  availability in your account. Results are best-effort and are not moderated by the feed's rules.
- Store the permanent key as the repository Actions secret **`JUICER_API_KEY`**.

See [Juicer authentication](https://juicer.mintlify.app/authentication.md). Never put the key in
configuration JSON, a `VITE_` environment variable, logs, commits, or workflow inputs.

### 2. GitHub App registration and installation

An organization owner or authorized app manager may need to perform these steps.

1. Open the owning organization/account's **Settings > Developer settings > GitHub Apps >
   New GitHub App**. Prefer ownership by `algoritmiaescom`.
2. Choose an available name such as **Huron Media Ingestion**. Use this repository URL as the
   homepage.
3. Disable active webhooks. No webhook receiver, hosted service, user OAuth, callback URL, or
   device flow is required.
4. Set repository permissions:
   - **Contents: Read and write** for the data branch/commits.
   - **Pull requests: Read and write** for creating/updating the PR.
   - **Metadata: Read-only**, provided automatically.
     Leave unrelated permissions disabled, including Workflows, Actions, and Checks write access.
5. Limit installation to the owning account, then install the app on `algoritmiaescom` with
   **Only select repositories > huron-scoreboards**.
6. Copy the app's **Client ID** (not App ID) to Actions variable
   **`MEDIA_INGESTION_APP_CLIENT_ID`**.
7. Generate a private key. Save the entire PEM, including markers and newlines, as Actions
   secret **`MEDIA_INGESTION_APP_PRIVATE_KEY`**. Secure the downloaded key outside the repo.
8. Confirm organization policy allows the app and the pinned Actions used in the workflow.

The workflow generates a short-lived installation token on each run, scoped to this repository
and the two write permissions. It revokes that token at job completion. Do not create a
long-lived app-token secret or a personal access token. The private key is used to obtain a token;
it is not itself a git credential.

See [GitHub App registration](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app)
and [App authentication in Actions](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/making-authenticated-api-requests-with-a-github-app-in-a-github-actions-workflow).

### 3. Repository settings

Under **Settings > Secrets and variables > Actions**, configure:

| Kind     | Name                               | Value                          |
| -------- | ---------------------------------- | ------------------------------ |
| Secret   | `JUICER_API_KEY`                   | Permanent Juicer key           |
| Secret   | `MEDIA_INGESTION_APP_PRIVATE_KEY`  | Complete private-key PEM       |
| Variable | `MEDIA_INGESTION_APP_CLIENT_ID`    | App Client ID                  |
| Variable | `MEDIA_INGESTION_SCHEDULE_ENABLED` | Leave unset until rollout ends |

Organization-level secrets/variables must explicitly allow this repository. Enable Actions and
allow the pinned actions. Keep branch protection, reviews, and required checks; do not give the
app a default-branch bypass. The built-in `GITHUB_TOKEN` stays read-only. The app token performs
git writes and PR creation, allowing normal PR CI to trigger.

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

Edit `config/media-ingestion.json`:

```json
{
  "events": [
    {
      "eventId": "your-real-event",
      "sources": [
        { "type": "feed", "feedId": 123, "platforms": ["x", "instagram"] },
        { "type": "hashtag", "platforms": ["x", "youtube"] }
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
an unfiltered feed containing unsupported platforms fails explicitly. Hashtag mode always uses the
event record's hashtag. Associate each configured feed with the intended event in Juicer; a
feed's public posts need not all contain a hashtag in their text.

For individual feed sources, use `"sourceIds": [12345, 67890]` instead of `platforms`.
These are Juicer source IDs, not social-post IDs. The two filter forms are mutually exclusive
because Juicer's `filter` parameter matches a list of sources rather than intersecting filters.

Date bounds are optional and inclusive in local filtering. Feed requests also pass the bounds to
Juicer, whose endpoint documents them as after/before filters. Direct mode filters locally:
it does not assume date-query support or stop pagination early. `maxPages` applies per
source/platform; `maxRequests` includes retries across the entire run. Hitting a limit fails,
rather than publishing an incomplete collection. Narrow sources or increase limits deliberately.
Retries apply only to network/timeouts, 429, and 5xx. A `Retry-After` exceeding 60 seconds fails
for a later run instead of exceeding the job budget.

## Run locally

The Node-only `JuicerClient` class in `scripts/media-ingestion/juicer.ts` uses a dedicated Axios
instance. It accepts request timeout, retry, page, and lifetime request budgets independently of
event configuration, so one instance can collect multiple sources. Create a new instance for a new
ingestion run to reset its request budget. Tests inject an Axios adapter and retry sleep function;
they exercise the real Axios request configuration without contacting Juicer.

Use Node 24, npm 11, and `npm ci`. Supply `JUICER_API_KEY` through your local secure environment;
the script does not automatically load an environment file.

```sh
npm run ingest:media -- --dry-run
npm run ingest:media
npm run ingest:media -- --config config/media-ingestion.json --dry-run
npm run validate:data
```

Dry-run collects and validates but changes nothing. Both modes print enabled source modes and
per-event counts for fetched, added, duplicate, suppressed, date-excluded, and newly imported missing-alt media items. Credentials
and raw response bodies are not logged. HTTP-200 platform errors, malformed responses, missing
required domain fields, repeated cursors, and exhausted limits fail the run.

All configured events are loaded before requests; all proposed changes are validated before
writing. Each changed file is formatted and replaced atomically. A filesystem failure during
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
- No invented body, author, timestamp, or attribution fills missing required fields. Such
  records fail ingestion and must be investigated rather than silently discarded.
- Existing posts are never refreshed or automatically removed when upstream data disappears.

To remove or reject a post, add its permalink to the event's `suppressedPermalinks` and manually
remove the archived post and its `postIds` entry if already present. Suppression prevents future
re-import; it does not delete existing content. Consider whether historical Git copies also need
removal for the applicable request. Manual corrections follow the normal contribution workflow.

## Automation and rollout

1. Merge the configured real event and workflow onto the default branch.
2. Run a local dry-run and confirm authentication, source relevance, and both enabled modes.
3. Manually run **Actions > Ingest media > Run workflow** on the default branch.
4. Review the resulting `automation/media-ingestion` PR. Verify normal validation, data, and E2E
   checks actually run; do not bypass missing checks.
5. Edit a description on the open data PR and rerun with a new upstream post. Confirm the edit
   survives. Repeat with unchanged input to verify no duplicates or unnecessary commits.
6. Set **`MEDIA_INGESTION_SCHEDULE_ENABLED=true`**. The daily cron is **12:17 UTC**. GitHub can
   delay scheduled runs; this is not a real-time service.

Runs are serialized. Existing PR changes must be limited to configured real event files. The
workflow merges that data branch into the trusted default-branch checkout before ingestion, so
curator edits are retained without executing branch-supplied code. Conflicts and unrelated PR
changes require manual resolution. Pushes are never forced; a concurrent remote edit fails.
When no media changes relative to the existing PR are found, no commit/PR update is made.

After merging (especially squash-merging) or closing an ingestion PR, delete its automation
branch before the next run. An unmerged leftover branch without an open PR blocks ingestion
rather than risking loss or accidental resurrection of rejected records. If branch push succeeds
but PR creation fails, open the PR manually or resolve the leftover branch before retrying.

The PR includes ingestion counts for review, not raw payloads. It never auto-merges. Failed
ingestion leaves the merged archive unchanged. Assign maintainers for failed-run notifications,
Juicer billing/connections, and app ownership. Public-repo schedules may be disabled after
prolonged inactivity; re-enable the workflow in Actions when needed.

For credential rotation, replace the affected secret, verify a manual run, then revoke the old
Juicer key or app private key. For emergency shutdown, disable the workflow and revoke the
credential/app installation. Never send secrets through chat or commit them.
