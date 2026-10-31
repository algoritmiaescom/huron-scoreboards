# Standings ingestion with GitHub Actions

Use the repository's **Ingest standings** GitHub Actions workflow to acquire official competition
evidence, inspect run artifacts, and create a proposal PR. This guide uses the GitHub website;
GitHub CLI commands are optional. You do not need a local Node/Python/OCR setup to dispatch a run.
This guide assumes the workflow is installed on the default branch and repository permissions are
already configured.
See the [data model](data-model.md) for field meanings and
[ADR 0008](adr/0008-ingest-standings-through-reviewed-proposals.md) for the ingestion architecture.

## What the pipeline does

The implemented flow is:

```text
Official source -> bounded acquisition -> candidate validation -> reconciliation
  -> workflow artifact -> proposal PR -> human review
   -> archive-shaped drafts -> human-reviewed archive PR -> validation -> merge
```

**Acquisition never writes archive records.** There is no command to apply a proposal to the
archive. A proposal PR contains evidence and suggested row references, not deployable competition
records. Merging it alone does not publish standings in the application. A draft helper converts
eligible records automatically, but you still review and submit its output in a separate archive PR.

Keep these datasets separate:

| Location                          | Purpose                                                                  |
| --------------------------------- | ------------------------------------------------------------------------ |
| `data/`                           | Published real archive; only verified official results belong here       |
| `data/mock/`                      | Invented application fixtures; never copy their results into the archive |
| `.standings-ingestion/proposals/` | Ignored local review proposals                                           |
| `.standings-ingestion/staged/`    | Ignored extracted documents and diagnostic evidence                      |
| `.standings-ingestion/cache/`     | Ignored, bounded parser cache                                            |
| `.standings-ingestion/drafts/`    | Ignored archive-shaped draft bundles and blocked-record reports          |
| `proposals/standings-ingestion/`  | Versioned proposal files published by automation                         |

## 1. Select and review source editions

Review the existing [source configuration](../config/standings-sources.json) before requesting a
season. Mexican edition years, dates when events were played, and ICPC cycle/URL identifiers are
different concepts; do not assume they are interchangeable.

| Source mode | Current coverage and limitations                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| ICPC Mexico | Recognized Fecha 0, qualifiers, repechage, and Finals; no committed edition mappings yet                   |
| ScoreLATAM  | Reviewed LATAM labels for 2019-2025; Mexico-local placement maps to Mexico Finals, not LATAM rank          |
| ITESO       | Accumulated GPM PDF/image evidence and season-standing candidates; no committed edition mappings yet       |
| ICPC Global | Directory and finder together, with reviewed 2025/2026 mappings; GPM results remain staged in this adapter |

An error such as `source edition 2025 has no reviewed season mapping` is a policy gate, not proof
that no official results exist. Check the source's displayed label and competition context first.
After review, append a mapping to `editionMappings` in the source configuration. For example, the
following shape maps an inspected ICPC Mexico label to its edition; it is not permission to skip
source review:

```json
{ "sourceId": "icpc-mexico", "editionLabel": "2025", "seasonYear": 2025 }
```

ITESO uses source ID `iteso`. Global directory labels use cycles such as `2025-2026`; finder labels
use editions such as `2025`. Keep existing mappings intact, avoid duplicate source/label entries,
and include the supporting source URL and review reasoning in your configuration PR. Resolve and
merge mapping changes before running default-branch automation that depends on them.

## 2. Dispatch an artifact-only run

1. Open the repository's **Actions** tab.
2. Select **Ingest standings** in the workflow list.
3. Click **Run workflow** and select the default branch under **Use workflow from**.
4. Fill in the inputs below. Start with `source=scorelatam`, `season=2025` if that edition's
   reviewed mapping is still configured. Leave both range fields empty.
5. Keep **Upload proposals only; do not create or update a review PR** checked (`dry_run=true`).
6. Click the final **Run workflow** button, then open the new run in the workflow list.

| Input         | What to enter                                                                               |
| ------------- | ------------------------------------------------------------------------------------------- |
| `source`      | Exactly one of `icpc-mexico`, `scorelatam`, `iteso`, or `icpc-global`                       |
| `season`      | One Mexican edition year, required except for an ICPC Mexico range                          |
| `season_from` | ICPC Mexico range start; otherwise leave empty                                              |
| `season_to`   | ICPC Mexico range end; otherwise leave empty                                                |
| `dry_run`     | Keep checked for artifact-only acquisition; uncheck to publish eligible proposal PR content |

Use one manual run per source. These are example selections, not guarantees of upstream availability:

| Source input  | Season input                     | Requested result                                               |
| ------------- | -------------------------------- | -------------------------------------------------------------- |
| `scorelatam`  | `2025`                           | Mexico-local Finals standings                                  |
| `icpc-global` | `2025` or `2026`                 | Directory + finder, Finals and GPM discovery                   |
| `iteso`       | An inspected year such as `2025` | Accumulated GPM document; review its edition mapping first     |
| `icpc-mexico` | An inspected year such as `2025` | Recognized contests for that edition; review its mapping first |

The workflow does not expose series/stage filters; ICPC Mexico acquires the matching recognized
contests for the year, up to 20 contests. Other sources require a single year. ScoreLATAM's 2020
edition was played in 2021 but remains edition 2020. ICPC Global collects directory/finder together.

In the run, inspect **Install bounded document and browser tools**, **Acquire bounded source
proposals**, **Validate repository and published archive**, and **Upload proposal and source
evidence**. For an artifact-only run, PR preparation/publication steps are skipped by design.

`dry_run=true` still contacts official sites and consumes runner time; it only disables PR
publication. Neither value applies archive records. Actions marks partial/failed acquisitions
unsuccessful after retaining evidence and, when applicable, publishing eligible proposals.

## 3. Review candidates and failures

On the run's summary page, find **Artifacts** and download `standings-ingestion-<RUN_ID>` after the
run finishes. Extract the ZIP and open the proposal JSON and staged evidence. The artifact contains
the collected proposal/staged directories and draft bundles, including hidden files; it is retained
for 14 days. Draft generation runs after repository validation, so an earlier validation failure
can leave proposals/staged evidence without drafts.
Inspect artifacts even when the run is red. If installation or acquisition failed before any
evidence was written, there may be no artifact; inspect the failed step's logs instead.

| Proposal field                         | Review task                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `candidates`                           | Check contest edition, stage, finality, source URL, row count, totals, detailed cells, and evidence     |
| `seasonStandingCandidates`             | Check accumulated scores/units, qualification annotations, snapshot state, pages, and evidence          |
| `additions`, `seasonStandingAdditions` | Follow each candidate ID and row index to the proposed value; these are references, not archive records |
| `identityProposals`                    | Resolve exact source team/school identities using official evidence                                     |
| `conflicts`, `seasonStandingConflicts` | Compare current/proposed values and alternative sources; do not overwrite archive records automatically |
| `sourceFailures`, `runIssues`          | Resolve policy, network, parser, identity-registry, or completeness failures                            |

`complete` means processing succeeded; it does not mean a human approved the data. A complete
proposal can still contain identity conflicts and zero additions.

Open staged artifacts referenced in warnings/failures. Compare extracted values to the actual
official HTML/document, including every page and row. Check the source content hash, parser version,
cell excerpts, PDF page numbers, and OCR confidence. High confidence is not a correctness guarantee.
Never silently repair ambiguous digits, missing pages, unknown qualification, or truncated tables.

Only explicitly official-final ITESO snapshots are eligible for additions. Intermediate and
unconfirmed snapshots remain review conflicts. Global GPM extraction still remains staged even
though the shared contract supports season standings through ITESO; manually review/transcribe
that evidence rather than expecting Global to emit season-standing additions today.

Keep staged evidence while the review is open. Actions artifacts expire after 14 days; versioned
proposal values and evidence locators remain in Git. Follow source redistribution policies before
committing downloaded documents or other media.

## 4. Resolve identities without guessing

The [identity registry](../config/standings-identities.json) starts empty. The reconciler only
resolves exact reviewed source IDs, never fuzzy team/school names. Consequently, zero additions
are normal on the first acquisition, especially while the real archive has no teams.

For a new school/team, verify its identity and manually add the canonical records to the real
archive in a focused PR. Academic units that compete separately need separate school records.
Teams belong to a single season; do not merge registrations across years just because names match.

Then add reviewed aliases whose targets already exist in the archive. A team alias has this shape;
the values below are illustrative, not an actual review or competition identity:

```json
{
  "entityType": "team",
  "sourceId": "iteso",
  "sourceIdentityId": "Exact inspected source identity",
  "seasonYear": 2025,
  "canonicalId": "2025-reviewed-team",
  "reviewedBy": "actual-reviewer",
  "reviewReference": "https://github.com/OWNER/REPOSITORY/pull/NUMBER",
  "reviewedAt": "2026-10-31T12:00:00Z"
}
```

School aliases use `entityType: school` and `seasonYear: null`. Source IDs and canonical targets
must exist, and duplicate aliases are invalid. Use the actual review identity, URL, and timestamp.
Do not fabricate reviewer provenance or add aliases targeting teams that have not been created.

Some HTML candidates have `sourceTeamId: null`; an alias cannot resolve an unavailable ID. Review
and map those rows manually during archive transcription. ITESO currently uses the extracted exact
team label as its source identity, so same-name ambiguity still requires human review.

Submit canonical records and alias/configuration changes through reviewed PRs, and merge them into
the default branch. Then dispatch **Ingest standings** again with the same source/year to reconcile
against that updated archive. The workflow cannot accept a local proposal file or unmerged feature-
branch aliases as input.

## 5. Publish and review the proposal PR

After inspecting the artifact, return to **Actions > Ingest standings > Run workflow**. Select the
same default branch, source, and edition; uncheck the upload-only/dry-run option (`dry_run=false`).
This starts a new acquisition, not publication of the previous artifact. Compare its new results
with the evidence you already reviewed, since upstream data may have changed.

The run now includes **Preserve an existing standings proposal PR** and, after successful
repository validation, **Publish append-only review proposals**. Look under **Pull requests** for:

- Title: `data: review standings ingestion proposals`.
- Branch: `automation/standings-ingestion`.
- Changes: proposal JSON under `proposals/standings-ingestion/` only, never archive files.

Check the description or newest run-summary comment for source, edition, candidate counts,
conflicts, unresolved identities, warnings, and the Actions artifact link. Inspect **Files changed**
for candidate values and evidence. Existing proposal files and reviewer edits are preserved;
follow-up run summaries are comments rather than replacements of the PR description.

A failed proposal containing only source failures is skipped; no empty PR is created. Independent
reviewable candidates/conflicts/identities can be published even with zero additions. A red
acquisition run can therefore have a useful proposal PR: the final source-failure reporting step
occurs after eligible publication. If repository validation fails, publication does not proceed.

The publisher explicitly dispatches **CI** on the automation branch. Check that run and the PR's
required checks: pushes made with the workflow token do not automatically trigger all normal
push/PR workflows. Do not merge while required checks or human review are outstanding. Approve and
merge only through normal repository review policy; automation never approves or merges.

### Optional GitHub CLI equivalent

These commands operate the same remote workflow, not local acquisition. Use authenticated GitHub
CLI from a checkout, replace `main` with the default branch, and replace `RUN_ID` with the actual
numeric ID from the run list:

```bash
gh workflow run ingest-standings.yml --ref main -f source=scorelatam -f season=2025 -f dry_run=true
gh run list --workflow ingest-standings.yml --limit 5
gh run view RUN_ID
gh run download RUN_ID --name standings-ingestion-RUN_ID
gh workflow run ingest-standings.yml --ref main -f source=scorelatam -f season=2025 -f dry_run=false
gh pr list --head automation/standings-ingestion
```

## 6. Review generated drafts and open an archive PR

The workflow's **Generate archive-shaped drafts for review** step runs for both values of
`dry_run`; draft generation does not publish or change the archive. After the workflow/helper
change is on the default branch:

1. Download the run's `standings-ingestion-<RUN_ID>` artifact and locate its draft bundles from
   `.standings-ingestion/drafts/`. Each bundle contains `report.json` and, when eligible,
   archive-shaped files under `data/seasons/`.
2. Read `report.json`: `files` lists generated records and their target paths, `blocked` explains
   refused candidates, and `warnings` retains review limitations, including accumulated score units.
3. Compare every generated record with the proposal and official source. The helper re-runs
   reconciliation against current configuration/aliases, requires all candidate rows to be
   eligible, rejects existing targets, and blocks competing candidates for one record. It never
   guesses identities, overwrites archive records, or generates partial scoreboards from eligible
   subsets. It validates drafts composed with the archive before writing a bundle.
4. Resolve blocked identities, mappings, source failures, incomplete coverage, or non-final
   snapshots and rerun acquisition. Empty draft bundles with diagnostic reports are expected while
   the archive/alias registry is empty. The helper does not create new schools, teams, or aliases.
5. On a separate contribution branch, add only reviewed generated record files at the target paths
   listed in the report. Do not copy `report.json`, proposals, or diagnostic evidence into `data/`.
   Open the archive PR and follow step 7; do not merge blindly because draft validation passed.

### Optional local helper

With Node 24 and repository npm dependencies installed, you can generate drafts from a downloaded
proposal without fetching any source or contacting GitHub:

```bash
npm run standings:draft -- path/to/proposal.json
```

The command accepts one or more proposal JSON paths and writes fresh bundles only under ignored
`.standings-ingestion/drafts/`. It has no archive-apply or arbitrary output-directory option, and
rejects output-directory symlinks. The output prints draft/blocked counts; inspect the report even
when the command succeeds. Failed saved proposals and run-level issues produce diagnostic-only
bundles. Validation or filesystem errors fail the command without approving or publishing anything.

### Manual fallback for blocked records

Create a separate contribution branch from the default branch for archive changes. Do not add
archive files to the stable automation branch: the publisher rejects unrelated paths on that branch.
Use the reviewed proposal PR or workflow artifact as evidence. You can create the archive files
through GitHub's web editor (choose a new branch and open a PR) or an ordinary local contribution
branch; the ingestion workflow itself has no archive-apply step.

Use the archive layout in [data/README.md](../data/README.md), not mock results:

```text
data/schools.json
data/seasons/<year>/teams.json
data/seasons/<year>/<series>/<stage>.json
data/seasons/<year>/<series>/standing.json
```

Include new schools/teams and their standings together when needed so all references resolve.
For each reviewed contest candidate:

1. Create a stable contest ID and preserve `seasonYear`, `seriesId`, stage, and verified metadata.
2. Convert `problemLabels` to ordered problem objects such as `{ "label": "A" }`; only include
   titles/URLs that have been verified.
3. Convert approved candidate rows to archive `standings` rows with canonical `teamId`, official
   place, `results`, and published totals when available. Do not copy candidate provenance fields
   or source identities into the archive row schema.
4. Use the official scoreboard URL for `source`. Preserve unknown dates, duration, penalty rules,
   and penalties as `null`; do not infer defaults. Detailed rows must cover every known problem.
   Totals-only rows use `results: null` and required `publishedTotals`.
5. Attempts include the accepted submission. Do not store derived first-to-solve values.

For accumulated standings, create one `standing.json` per season/series with `seasonYear`,
`seriesId`, `source`, and rows containing only `place`, canonical `teamId`, published `score`, and
`qualified`. Preserve unknown qualification as `null`. Do not recalculate accumulated scores from
contest results or rescale source units. The current archive schema has no score-unit field; retain
the unit/qualification annotations in review evidence and explain them in the archive PR.

Existing archive records are not automatic update targets. If a proposed value disagrees with a
published record, investigate and submit an explicit correction with evidence. Missing upstream
rows are not permission to delete archive rows. Do not paste an entire proposal or staged artifact
into the archive and do not promote invented mock records.

## 7. Validate and merge the archive PR

Open the separate archive PR with source URLs, a link to the proposal PR/run, edition-mapping
rationale, identity decisions, extraction limitations, and any changes to existing records.

On the PR's **Checks** tab, wait for the **CI** workflow: repository validation, data validation,
application E2E tests, and Python checks/tests must pass as required by repository policy. Data
validation checks schema and cross-file references. Fix any reported errors on the archive PR
branch and wait for the next CI run. For local authoring/validation commands, see
[CONTRIBUTING.md](../CONTRIBUTING.md).

Inspect **Files changed** and compare every result with the official source; valid JSON or passing
tests alone do not establish correctness. Obtain human review before merging. Only merged archive
files, not merged proposal files, are application inputs; deployments configured to serve the real
archive can then expose those records.

## 8. Repeat safely and roll out scheduling

Dispatch the same source/year again and compare substantive candidate rows, not run timestamps or
filenames. Each acquisition writes a new proposal; **Files changed** on the automation PR must
still contain no archive modifications.

After verifying a single-year run, use **Run workflow** for a small ICPC Mexico batch:

| Input         | Example value                                         |
| ------------- | ----------------------------------------------------- |
| `source`      | `icpc-mexico`                                         |
| `season`      | Leave empty                                           |
| `season_from` | `2024`                                                |
| `season_to`   | `2025`                                                |
| `dry_run`     | Checked first; uncheck only after reviewing artifacts |

Ranges are supported only for ICPC Mexico: at most five years and 20 contests, with reviewed
mappings for each requested edition. Supply both range fields, never a range and `season`
together. Narrow the run when budgets or completeness checks fail; do not disable guards to force
an import.

Under **Settings > Secrets and variables > Actions > Variables**, create or update repository
variable `STANDINGS_INGESTION_ENABLED` with value `true` only after a manual proposal PR,
dispatched CI, human review, and a small historical batch have been exercised. Scheduling refreshes
the previous/current UTC years every Monday at 07:00 UTC; future edition mappings still require
review. Leave the variable unset or set it to another value to disable scheduling without altering
archive records. Scheduled proposals still require human review and manual archive transcription.

## Troubleshooting

| Symptom                                  | Next step                                                                                                                     |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Missing reviewed edition mapping         | Inspect the official label/context, add only the verified mapping, and rerun                                                  |
| Zero additions or unresolved identities  | Review `identityProposals`, create canonical records, then add exact reviewed aliases where source IDs exist                  |
| Low-confidence OCR or ambiguous digits   | Inspect the source document/page and staged extraction; repair the parser or transcribe manually with evidence                |
| Incomplete/paginated/unranked rows       | Keep the extraction staged; do not drop rows, invent places, or claim completeness                                            |
| Tool installation failure                | Inspect the workflow installation logs; check runner/network/package availability and rerun after fixing setup                |
| Browser origin/request-budget rejection  | Inspect the URL and source policy; do not bypass allowlists or source access challenges                                       |
| No proposal PR appears                   | Confirm `dry_run=false`, default-branch execution, successful repository validation, permissions, and proposal publishability |
| Stable branch contains unrelated changes | Resolve branch state manually; keep archive transcription on a separate branch                                                |

Keep failed proposals and staged evidence for diagnosis. No guide command automatically applies
results, approves a PR, merges a PR, or changes the scheduling variable.
