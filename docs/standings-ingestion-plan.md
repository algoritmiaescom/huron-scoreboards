The full `npm run validate` gate passed with 386 tests before this resolver change; no live source
fetch, archive edit, or identity mapping was made.
The current `npm run validate` gate passes with 390 tests, data validation, formatting, lint, type
checking, coverage, and production build. Adapter acquisition tests inject all responses; no live
source fetch, archive edit, or identity mapping was made.
2026-10-29 M4 follow-up: event-page scoreboard discovery accepts exactly one normalized
same-origin HTTPS destination and stages missing, external, or ambiguous links. Added the
`--acquire-icpc-mexico --season YEAR` CLI flow with optional series/stage filters, a 20-contest
limit, shared bounded acquisition/caching, and proposal-level failure reporting. Offline tests
cover successful index-to-scoreboard acquisition, external-link rejection, and season bounds.
`npm run validate` passed with 390 tests; `git diff --check` passed. No source records were
imported.

# Standings ingestion implementation plan

Status: M2, M4, M5, and M7 done; M1, M3, M6, and M8 remain in progress. The hosted M1 benchmark passed; overall Actions job duration remains pending before formal closure.

Created: 2026-10-27. Last updated: 2026-10-31.

## Purpose and use

Build scripts that collect historical Mexican ICPC standings from multiple sources and propose
validated additions through reviewed GitHub pull requests. This is a living implementation plan:
update it in the same change that completes a milestone, so work can resume from another machine
without relying on chat history.

This plan does not mean the pipeline, commands, schemas, or workflow described below already
exist. The existing [data model](data-model.md), [architecture](architecture.md), and
[media ingestion](media-ingestion.md) are starting points, not proof of standings-ingestion support.

### Updating progress

- Use `pending`, `in progress`, `blocked`, or `done` in the milestone table.
- Mark acceptance checkboxes only after verification, not just implementation.
- Record changed behavior, validation commands/results, and any PR or commit in the progress log.
- For unfinished work, record the exact next step and blockers in the handoff section.
- Update this plan when decisions change; explain the reason in the progress log.
- Put implemented domain rules in `data-model.md` and product behavior in `product-scope.md`.
  Record architecture decisions in `docs/adr/` and link them here rather than making this plan
  their permanent source of truth.
- Commit and push plan updates with the corresponding work to share progress across machines.
  Never record credentials, machine-specific secrets, or private Ollama endpoints here.

## Agreed requirements and policies

| Area             | Decision                                                                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime          | Node 24 and npm 11 for orchestration; a small Python integration for PAR Scrape.                                                                      |
| Web extraction   | Use [PAR Scrape](https://github.com/paulrobello/par_scrape) with local Ollama; support JavaScript-rendered content and explicit browser interactions. |
| Documents        | Support text PDFs and local OCR for scanned PDFs and result images.                                                                                   |
| Execution        | Benchmark standard GitHub-hosted Linux with Ollama on the runner before choosing the model and enabling scheduling.                                   |
| Triggers         | Manual historical backfill and a weekly refresh of the current and previous Mexican edition years.                                                    |
| Existing archive | Never remove or overwrite existing records, including rows and metadata. Report proposed differences for manual selection.                            |
| New records      | Select the configured preferred source, report disagreements, and propose only validated, source-backed data.                                         |
| Partial history  | Support detailed and totals-only standings, explicitly unknown metadata, and unknown qualification status.                                            |
| Fecha 0          | Include as a distinct non-qualifying stage, not as qualifier 1.                                                                                       |
| Season identity  | Use the Mexican competition edition year, with explicit mappings for differing source labels.                                                         |
| Accumulated GPM  | Archive only the latest official accumulated standing for an edition, not every intermediate snapshot.                                                |
| Identities       | Reuse reviewed aliases; propose unambiguous schools and teams; stage ambiguous matches instead of fuzzy auto-merging.                                 |
| Rosters          | Do not collect participant rosters by default.                                                                                                        |
| Review           | No automatic approval or merge. Preserve reviewer changes on an existing automation PR.                                                               |
| Datasets         | Never import into or promote records from `data/mock/`.                                                                                               |

Preferred source order, with per-season overrides:

- GPM qualifiers, Fecha 0, and repechage: ICPC Mexico.
- GPM accumulated: ICPC Mexico, then ITESO, then ICPC Global.
- Mexico Finals: ICPC Mexico, then ICPC Global, then ScoreLATAM.
- ICPC Global directory and finder are discovery paths for the same authority, not independent
  corroboration.
- Compare equivalent editions, events, scopes, snapshots, and publication states. Prefer final
  official results over provisional ones; never silently combine contradictory versions.
- If a preferred source lacks fields available elsewhere, report the alternative and its
  provenance rather than silently filling fields across sources.

For an existing accumulated standing, a newer official snapshot is still a proposed manual
change. "Latest" never bypasses archive immutability.

## Pipeline and boundaries

```text
Site discovery adapters
  -> HTML fetching/rendering or document download
  -> Source-backed extraction candidates
  -> Edition, contest, school, and team normalization
  -> Completeness and numerical validation
  -> Cross-source and archive comparison
  -> Archive additions plus review proposals
  -> GitHub PR and explicitly triggered CI
```

Keep orchestration, domain normalization, validation, and reconciliation in TypeScript. Use
explicit browser adapters for selectors, accordions, filtering, and navigation; use PAR Scrape
and Ollama for structured web extraction, with deterministic parsers/checks for known formats.
Use a separate local PDF/OCR pipeline. Confirm the PAR Scrape integration in M1 before committing
to an API: rendering a page does not itself support arbitrary multi-step interactions.

Each candidate must retain discovery and final URLs, source identifiers and edition labels,
retrieval time, content hash, parser/prompt/model versions, original cells or PDF page references,
published ranks/totals, and missing-field or validation warnings.

Large downloaded documents and rendered snapshots belong in bounded-retention workflow artifacts,
not the application bundle. Candidate values and conflict explanations needed to decide a PR
must remain reviewable without depending entirely on expiring artifacts. Decide their versioned
proposal layout in M3; proposals must not be loaded as published archive records.

Treat web/PDF content and LLM output as untrusted. Do not let extracted instructions control shell
commands, paths, or unrestricted crawling. Apply request, page, file-size, traversal, retry, and
runtime budgets; respect source access policies and do not bypass authentication or challenges.
Keep Ollama local to the execution environment and GitHub credentials out of extraction processes.

## Milestones

| ID  | Milestone                                               | Prerequisites            | Status      |
| --- | ------------------------------------------------------- | ------------------------ | ----------- |
| M1  | Integration and cost feasibility spike                  | None                     | in progress |
| M2  | Partial historical standings model and UI               | None                     | done        |
| M3  | Shared candidate, identity, and reconciliation pipeline | M1, M2                   | in progress |
| M4  | ICPC Mexico adapter                                     | M3                       | done        |
| M5  | ScoreLATAM adapter                                      | M3                       | done        |
| M6  | ITESO adapter and PDF/OCR extraction                    | M3                       | in progress |
| M7  | ICPC Global directory and finder adapters               | M3, M6 document pipeline | done        |
| M8  | Reviewed-PR automation and controlled rollout           | M4, M5, M6, M7           | in progress |

### M1: Integration and cost feasibility spike

- [x] Pin a compatible PAR Scrape/Python environment and establish a reproducible installation.
- [x] Demonstrate that extraction receives the selected rendered state, not a fresh page that
      loses season selections, expanded accordions, or country filters.
- [x] Verify a JavaScript interaction, a text PDF, and a scanned-table OCR example.
- [x] Benchmark a small Ollama model on standard hosted Linux against manually verified cells.
      Record runner resources, model identifier/digest, context limits, model download time,
      runtime, peak memory, extraction errors, and estimated weekly/backfill minutes.
- [x] Choose explicit correctness and runtime acceptance thresholds from the benchmark; do not
      enable the schedule merely because the model returned valid JSON.
- [x] Document local setup, model licensing, cache needs, and the proposed integration boundary.

Implementation and local results are in the [M1 spike report](standings-ingestion-spike.md).
The manually dispatched hosted benchmark passed on 2026-10-28: all three extractions exactly
matched the expected rows, inference took 21.86, 8.52, and 8.55 seconds, and peak sampled aggregate
RSS was approximately 1.72 GiB. Retain the exact-match, 120-second-per-extraction, and 6-GiB gates
for this synthetic feasibility test only. The supplied report records a 53.23-second harness run,
not total Actions job duration. The user supplied [run 40640725672](https://github.com/algoritmiaescom/huron-scoreboards/actions/runs/40640725672),
a 129-second Ollama installation timing artifact, and a log showing 0.53-second model-runner
startup. The run page returned HTTP 404 from this environment; record the overall job duration
before marking M1 done. No production schedule is authorized by this result.

The repository is private: hosted usage consumes the account's included minutes and can incur
charges beyond its quota. Check current allowance and pricing before rollout. Start without a
rented GPU. Reconsider an existing self-hosted machine if measured runtime makes it cheaper;
self-hosting has hardware, electricity, maintenance, and trusted-runner implications.

### M2: Partial historical standings model and UI

- [x] Extend the existing Zod schemas and inferred types with a distinct Fecha 0 stage.
- [x] Represent detailed versus totals-only rows, including mixed-detail standings when needed.
- [x] Represent unknown dates, duration, penalty rules, and qualification explicitly; do not
      fabricate values or interpret unknown qualification as `false`.
- [x] Keep source-published totals as observations and computed totals authoritative for complete
      detailed results; define how mismatches block or stage publication.
- [x] Preserve the convention that attempts include the accepted submission.
- [x] Update repository validation, derived calculations, filters, tables/cards, and historical
      views. Unknown values must not render as zero or unattempted.
- [x] Preserve existing complete-record behavior and test partial-data rendering/accessibility.
- [x] Update the data model, product scope, and contribution guidance for the new shapes.

Implemented on 2026-10-28. Historical metadata and qualification use explicit `null`; totals-only
rows use `results: null` with required `publishedTotals`. Mixed-detail contests are supported,
and contradictory computable totals fail both CI and the runtime repository boundary. Missing
problem details never become unattempted cells, and first-solve claims are suppressed when any
row lacks detail. Undated contests remain explicitly selectable and present in school history,
but are ineligible for latest-held/media selection. The initial M2 implementation left archive
and mock JSON unchanged.

Mock-data follow-up: the 2023 first qualifier now exercises totals-only history with unknown
metadata/problem set, preserving all 12 original synthetic teams, places, solved counts, and
penalties. Its second qualifier mixes detailed rows with a totals-only leader whose penalty is
unknown. The real archive and other seasons are unchanged. `npm run validate:data` passed;
two new archive-route browser tests passed at 390px and 1440px, covering reload, filters, and
accessibility. See [mock data examples](../data/README.md).

Verification: `npm run validate` passed (317 tests, data validation, formatting, lint, type checks,
coverage, and production build). `npm run test:e2e -- --workers=2` passed all 49 browser tests,
including partial-data filters, mobile/desktop reflow, and light/dark accessibility checks.
Screenshots were inspected at 390px and 1440px. Chromium dependencies missing from this machine
were extracted into a temporary user-owned directory and supplied via `LD_LIBRARY_PATH`; no
system packages or repository configuration were changed.

### M3: Shared pipeline

- [ ] Define source configuration, preferred-source/per-edition overrides, edition mappings,
      candidate/evidence schemas, and a versioned review-proposal format.
- [ ] Add reviewed identity aliases using source IDs where available; handle slug collisions,
      same-name teams, and separately competing academic units without automatic fuzzy merges.
- [ ] Add bounded fetching/rendering, explicit failure outcomes, stable serialization, and caching
      keyed by content plus parser/prompt/model configuration.
- [ ] Validate table completeness, unique identities, problem counts, row counts, ranks/ties,
      published solved totals, and penalties when sufficient evidence exists.
- [ ] Detect live/frozen/provisional results; do not treat them as final by default.
- [ ] Implement dry-run, source/edition selection, and bounded backfill controls.
- [ ] Propose validated new records and required identities atomically; preserve every existing
      archive record, including when upstream rows disappear or metadata is enriched.
- [ ] Produce row/field-level conflicts and alternative-source evidence, including conflict-only
      runs with no archive additions.
- [ ] Test idempotent reruns, disagreements, incomplete inputs, source removal, and ambiguous
      identities. Independent successful candidates may proceed, but incomplete runs must be
      unmistakable in both workflow status and review reports.

Initial M3 contracts are implemented in `src/features/scoreboards/ingestion/`: the versioned
source registry validates authority grouping, stage support, priorities, and season overrides;
edition labels require explicit reviewed mappings before candidate acceptance. The candidate
schema retains source URLs, retrieval time, content hash, parser/model versions, publication
state, row data, and evidence locators. Candidate checks cover unique source identities, ranking,
problem counts, solve duration, and computable published totals. Version-1 proposals retain
candidate references, conflicts, alternative evidence, additions, and source failures; incomplete
runs and non-final candidates cannot propose additions. The reviewed identity registry resolves
only exact source IDs with reviewer provenance and validates canonical school/team targets. The
ICPC Global directory and finder have distinct source IDs but share one authority ID.

The initial source priorities are in `config/standings-sources.json`; the reviewed alias registry
starts empty in `config/standings-identities.json`. Edition mappings deliberately remain empty
until a source label is confirmed and reviewed. `reconcileCandidates` is a dry-run comparison:
it emits additions/conflicts by candidate-row reference, never changes the archive, and permits
independent additions from a partial run only when no run-wide validation issue exists.
Candidate coverage records expected row count, row completeness, and pagination completion; these
gate additions while preserving incomplete evidence for review. `BoundedSourceFetcher` restricts
requests and manual redirects to a configured HTTPS origin and applies request-count, timeout,
redirect, and response-byte budgets with typed failure results. `parseFetchedContent` connects
content hashes and parser/prompt/model settings to the bounded, Zod-validated cache. Offline tests
inject network responses; the workflow does not contact competition sites. The generic Playwright
renderer restricts page and subresource requests to the configured HTTPS origin, runs a bounded
explicit click/select/wait sequence, waits for a source-provided ready selector, and captures one
size-limited selected element. Source-specific interaction recipes are not configured yet.
`acquireStandingsCandidate` and the bounded sequential `acquireStandingsBatch` enforce preferred
source/edition policy, fetch or render selected content, cache parser output, validate requested
contest identity, and retain provenance. `standings:ingest` supports both operator-supplied
candidate files and a bounded `--acquire-icpc-mexico --season YEAR` flow; the latter discovers
contest and scoreboard pages, then feeds parsed candidates into the same dry-run proposal path.
The CLI validates the real archive and atomically writes proposals under ignored
`.standings-ingestion/proposals/`; it never changes `data/`. Source edition mappings remain
review-gated, and source-specific completeness checks beyond the ICPC Mexico row count are not
implemented. Remaining M3 acceptance items stay unchecked until their runtime behavior exists.

### M4: ICPC Mexico

Entry: <https://www.icpcmexico.org/contests>

- [x] Traverse season groups and classify GPM season pages, Fecha 0, qualifiers 1-3, repechage,
      and Mexico Finals.
- [x] Exclude explicit training camps, Masters, and LATAM championships; stage unknown
      contest-shaped links rather than acquiring them.
- [x] Inspect each GPM season page for accumulated standings or outgoing result links; report
      missing standings explicitly rather than producing empty results.
- [x] Parse DOM/structured data with intact cell boundaries. Do not parse flattened page text
      that merges adjacent numbers.
- [x] Verify the inspected scoreboard layout's accepted/failed/unattempted notation and penalty
      rule using synthetic table fixtures.
- [x] Dispatch linked PDFs through the document pipeline when available; otherwise explicitly
      stage those destinations until M6 is complete.
- [x] Preserve official participant scope: GPM scoreboards may include non-Mexican schools.
- [x] Test representative stages, a missing accumulated result, an external link, provisional
      data, and a source-layout change.

The source-specific adapter discovers ICPC Mexico season and contest links, distinguishes Fecha 0,
qualifiers, repechage, and Mexico Finals, and reports accumulated-standing links as missing or
ambiguous rather than returning an empty result. Its parse5 scoreboard parser preserves HTML cell
boundaries, published totals, and cell evidence; unknown notation becomes totals-only and row-count
mismatches mark coverage incomplete. Source IDs remain null because the inspected scoreboard
exposes no stable team or school identifiers. The index adapter explicitly excludes training
camps, Masters, and LATAM championships; unknown contest-shaped links remain staged. Event-page
discovery resolves one normalized same-origin HTTPS scoreboard destination, stages PDF and external
destinations, and reports missing or ambiguous links. GPM school rows are not filtered by country.
The CLI supports one season or inclusive backfills of up to five seasons, caps runs at 20 contests,
and retains discovery/acquisition failures in the review proposal. Candidate acceptance requires a
reviewed source-edition mapping. Offline tests cover representative stages, partial/unknown cells,
row-count mismatches, unsupported layouts, publication states, international participants, PDF
staging, exclusions, multi-season acquisition, and overflow. `npm run validate` passed with 394
tests, data validation, formatting, lint, type checking, coverage, and production build. No live
source fetch, archive edit, or identity mapping was made; PDF parsing remains deferred to M6.

### M5: ScoreLATAM

Entry: <https://scorelatam.naquadah.com.br/>

- [x] Discover editions under LATAM only, excluding PdA and other regional groups.
- [x] Preserve edition labels independently of dates played, including the 2020 edition played
      in 2021.
- [x] Apply the Mexico group and obtain its official Mexico-local placement separately from
      overall LATAM rank.
- [x] Independently verify membership using the exact `/MX` suffix in User/Site.
- [x] Stage extraction if Mexico-local placement is missing or membership cannot be verified;
      never derive replacement places from LATAM rank.
- [x] Deduplicate repeated Mexico-group table representations by source team identity and parse
      problem attempts/times and published totals.
- [x] Preserve LATAM rank as evidence and map Mexico-local placement to Mexico Finals only after
      the maintainer's explicit equivalence approval.
- [x] Confirm event equivalence before mapping Mexican participants to Mexico Finals.
- [x] Test mixed countries, duplicate representations, ties, hidden group rows, and absent or
      invalid local ranks.
- [x] Detect pagination/incremental-load controls and stage the page rather than claim complete
      Mexico-group coverage when pagination traversal is unavailable.

The ScoreLATAM edition adapter recognizes `/latam-YYYY/` links only in the exact LATAM section,
preserving source labels independently from URL edition years and extracting a played year only
when explicit (for example, edition 2020 played in 2021). The Mexico-score parser selects the
Mexico toggle group separately from `Global` and `CCL Mexico`, takes local placement from that
group, and joins global placement by full User/Site identity. Only exact `/MX` suffixes are
accepted; missing ranks, malformed membership, conflicting duplicate data, or non-standard local
ranking stage the extraction. Cell evidence retains both ranks and each problem/total value.
`standings:ingest -- --acquire-scorelatam --season YEAR` uses a three-request same-origin budget,
writes the extraction and provenance atomically under ignored `.standings-ingestion/staged/`, and
emits a review proposal linking the artifact. The maintainer approved Mexico Finals equivalence;
ready extractions now become final-stage candidates using Mexico-local place, with global LATAM
rank retained only as evidence. Reviewed edition mappings for the LATAM years listed on the
source index (2019-2025) are in `config/standings-sources.json`; the 2020 edition maps to 2020
although it was played in 2021. Other/unlisted source labels still require review. Reconciliation
and identity resolution remain manual. Tests use synthetic tables and injected responses; no
official ScoreLATAM page is saved as a fixture or imported. The
inspected static layout has no pagination controls; if `rel="next"`, pagination markers, or
page-style query controls appear, the adapter stages the extraction with unknown completeness
rather than omitting later rows silently. It does not yet traverse additional pages.

### M6: ITESO and document extraction

Entry: <https://eventos.iteso.mx/acm/>

- [x] Traverse sidebar season groups and identify accumulated GPM links using reviewed naming
      variants, preserving the season context.
- [x] On each result page, follow the anchor enclosing the result image rather than downloading
      only its thumbnail.
- [x] Resolve redirects and dispatch by actual response type, not URL extension alone.
- [x] Extract text-PDF tables with page references; join multi-page tables and remove repeated
      headers without losing rows.
- [x] Run local OCR for scanned PDFs/result images; preserve uncertain cells for review instead
      of silently correcting them.
- [ ] Preserve accumulated score units and qualification annotations; distinguish intermediate
      snapshots from the latest official result.
- [x] Test text PDFs, scans, multi-page results, linked images, redirects, and ambiguous digits.

M6 implementation started: the ITESO adapter discovers season-scoped accumulated-result links,
follows image-enclosing document anchors, and uses the bounded fetcher with the reviewed
`acm.iteso.mx` HTTPS origin. `--acquire-iteso --season YEAR` dispatches from response content
type/signature and atomically stages page text, extracted cells, page references, score units,
qualification text, OCR confidence, and snapshot wording. The deterministic parser joins
multi-page tables, skips repeated headers, and stages ambiguous numbers, unknown qualification
values, inconsistent layouts, and weak OCR confidence. It never writes `data/` or emits a contest
candidate for a season-standing document. The shared proposal contract currently supports contest
candidates only, so source-native season-standing reconciliation remains a separate required step.
Focused synthetic adapter/parser/CLI/fetch tests pass (27 tests), along with TypeScript checking;
the locked Python harness tests pass (12 tests). `uv 0.9.22` and the locked Python project are
installed for this user; Tesseract 5.5 and English/OSD data are extracted under `~/.local` without
system package changes. The ITESO helper was exercised with generated text, scanned, and two-page
PDFs; the scan retained 0.96 per-cell OCR confidence and all generated rows/page references were
preserved. The full offline Playwright/PDF/OCR harness passed with the user-local Chromium libraries.
The shared proposal contract supports contest candidates only, so source-native season-standing
reconciliation remains necessary. Interpreting which source document is the latest official result
also remains open; no real competition document was imported.

### M7: ICPC Global

Directory: <https://icpc.global/regionals/contests>

- [x] Enumerate season choices, select each requested cycle, wait for refreshed content, and
      expand Latin America.
- [x] Identify Mexican GPM/Mexico Finals from contest context and metadata, not loose name
      matching; follow the Standings-column destination when present.
- [x] Route recognized HTML, unfamiliar rendered HTML, PDFs, and bounded landing-page discovery
      through the shared extractors; report missing buttons explicitly.

Finder: <https://icpc.global/regionals/finder/mexico>

- [x] Record the displayed edition and collect the main See Standings link and GPM Contest List
      entry before visiting children.
- [x] Follow the GPM entry to accumulated results, then follow See Prior Year from the saved
      edition context rather than relying on browser-back state.
- [x] Stop when prior-year navigation is absent; detect repeated URLs/editions and enforce limits.
- [x] Exclude Women's League, Masters, and training camps.

Shared acceptance:

- [x] Map inspected ICPC cycle labels and URL identifiers to Mexican edition years explicitly; all
      unlisted labels require a reviewed configuration mapping. The inspected
      2026 Mexico Finals page links to identifiers ending in `2027`; suffixes are not edition years.
- [x] Deduplicate shared destinations discovered through directory and finder.
- [x] Test season updates, historical navigation, missing standings, cycle mismatches, loops,
      unfamiliar external HTML, and PDF destinations.

M7 implemented for the explicitly reviewed 2025 and 2026 Mexico editions: the ICPC Global adapter parses the selected Latin America contest
table, cross-checks displayed Mexican edition years against consecutive cycle labels and the
observed `+1` URL identifiers, excludes Masters/Women's League/training camps, and records the
separate Standings-column destination. Finder pages are rendered from saved edition context;
traversal is sequential, bounded to 20 pages, and stops on repeated URLs or absent prior-year links.
Standings capture selects a bounded 1000-row page and waits until the visible range and DOM row count
agree. Unranked rows stage the Global candidate rather than being dropped. The directory's separate
ScoreLATAM Mexico Finals URL is fetched and parsed through M5 as an alternative candidate when its
reviewed edition mapping is present. GPM results are routed through HTML/PDF/image dispatch and the
M6 extractor, but remain staged because season-standing candidates are not yet in the shared
proposal schema. Reviewed mappings for 2025 and 2026 are configured; unlisted historical labels fail
closed until reviewed. The live 2025 run produced a partial proposal with a complete 133-row
ScoreLATAM candidate, preserved the Global standings HTML containing eight unranked rows, and staged
the GPM PDF extraction. No archive data changed. Nonessential analytics and the observed Carto map
style are blocked; other external origins remain subject to the source allowlist. M7 acceptance
is complete for the reviewed editions; additional historical cycles require their own explicit
configuration mappings before acquisition.

### M8: Automation and rollout

- [x] Add manual dispatch with source/edition filters, dry-run, and bounded backfill controls.
- [x] Add a weekly schedule for current/previous editions, disabled by a repository variable until
      rollout passes; define the edition-boundary/timezone behavior explicitly.
- [x] Use trusted default-branch execution, pinned dependencies/actions, scoped permissions,
      concurrency control, timeouts, and bounded artifact retention.
- [x] Reuse the media workflow's reviewed-PR patterns where appropriate, after checking helpers
      for actual compatibility rather than assuming they are generic.
- [x] Maintain a stable automation branch/PR without overwriting reviewer edits.
- [x] Publish conflict-only proposals as well as additions. Include coverage, source failures,
      existing/proposed values, alternatives, partial-data/OCR warnings, unresolved identities,
      and evidence/version details in the PR.
- [x] Validate proposed data and explicitly trigger required CI when token-generated events do
      not start it. Never approve or auto-merge.
- [ ] Verify a manual end-to-end PR, then small historical batches, then the weekly schedule.
- [x] Document setup, cost controls, recovery, reruns, conflict resolution, and how to disable
      scheduling without changing or deleting archived data.

M8 implementation: [.github/workflows/ingest-standings.yml](../.github/workflows/ingest-standings.yml)
runs only on the default branch. Manual dispatch selects one source and edition; ICPC Mexico alone
accepts inclusive ranges capped at five years and 20 contests. `dry_run` defaults to true: it uploads
the proposal and staged evidence but does not publish a PR. Set it to false to publish reviewable
proposals. The Monday 07:00 UTC schedule is gated by repository variable
`STANDINGS_INGESTION_ENABLED == 'true'`; it derives the current and previous edition years from the
UTC calendar year, runs one bounded ICPC Mexico range and one ICPC Global acquisition per year. The
schedule remains disabled until an operator enables that variable.

The workflow uses Node 24/npm 11, pinned checkout/setup/upload actions, locked uv 0.9.22 Python
dependencies, Tesseract English OCR, Chromium, a 60-minute job timeout, a non-cancelling concurrency
group, and 14-day evidence artifacts. Source request, page, response, and traversal limits remain in
the adapters. The publisher validates proposal JSON, writes only append-only files under
`proposals/standings-ingestion/`, and refuses any other changed path. It prepares stable branch
`automation/standings-ingestion` by merging only an existing proposal-only PR branch; concurrent or
unrelated changes fail rather than being force-pushed. Existing proposal files and PR bodies are
preserved; new run summaries are added as comments. Every publication explicitly dispatches `ci.yml`; approval and merge
remain manual. Failed-only runs are retained as workflow artifacts, while complete, partial, and
conflict-only proposals can be reviewed. To disable scheduling, unset or set
`STANDINGS_INGESTION_ENABLED` to anything other than `true`; manual dry runs remain available.
Recovery is to inspect the failed run's proposal/evidence artifact, correct source configuration or
parser logic, and rerun the same source/edition. Do not copy staged values into `data/` without review.

## Verification and completion gate

Use offline source fixtures and injected browser/network/model boundaries for deterministic tests;
live-site smoke checks supplement rather than replace them. Use representative real-source
fixtures only where their redistribution is permitted, and never label invented fixture results
as archive data.

Every implementation milestone must record focused tests and `npm run validate`. Run
`npm run test:e2e` for user-facing workflows, especially M2. A milestone is not done while its
required acceptance criteria or validation remain unverified.

Final acceptance must prove:

- Identical reruns produce no archive diff.
- Conflicting, missing, truncated, or removed upstream results never modify existing records.
- Required output shapes and fixture row/cell values match exactly, not merely valid JSON.
- Unknown historical values remain unknown throughout persistence and presentation.
- Source failures cannot masquerade as successful empty scoreboards.
- A second machine can reproduce local setup and resume from this document.
- An automation PR is reviewable and preserves reviewer edits; no unattended merge occurs.

## Current handoff

- **Next step:** run one manual M8 workflow with `dry_run=false` on the default branch, review the
  proposal-only PR and dispatched CI, then try a small historical batch. Keep the weekly schedule
  disabled until that PR is reviewed and merged. Add reviewed ICPC Global mappings only for
  additional requested historical cycles. Continue the M6 source-native season-standing contract
  and latest-official verification, and preserve the M1 overall Actions job-duration follow-up.
- **Blockers:** no GitHub workflow dispatch or live PR publication has been performed. The weekly
  schedule remains disabled unless repository variable `STANDINGS_INGESTION_ENABLED` is exactly
  `true`. The supplied M1 artifacts still lack overall Actions job duration, and the run page is
  inaccessible from this environment.
- **Implementation evidence:** locked Python environment, synthetic rendered-state/PDF/OCR checks,
  three successful local and three successful hosted Ollama extractions, and failure-handling
  tests. See the spike report for portable results and limitations. M3 source/candidate/identity
  contracts, dry-run reconciliation, bounded fetching/cache, generic selected-state rendering, an
  acquisition API/batch, and the offline candidate-file review CLI are implemented. The ICPC Mexico
  adapter and bounded acquisition CLI are complete for the tested HTML source shape; ScoreLATAM
  discovery, Mexico-group extraction, staged CLI reporting, reviewer-approved event equivalence,
  and explicit edition mappings for listed LATAM years are implemented. ITESO discovery, bounded
  document fetching, and staged extraction are in progress; source-native season-standing candidate
  reconciliation remains open. ICPC Global discovery, totals parsing, bounded history traversal,
  reviewed 2025/2026 mappings, ScoreLATAM alternative candidate fallback, and staged GPM document
  acquisition are implemented. M8's default-branch workflow, disabled-by-default UTC schedule,
  proposal-only stable branch publisher, append-only versioned proposal path, failure artifact
  upload, and explicit CI dispatch are implemented. The live 2025 M7 workflow produced a reviewable
  partial proposal and changed no archive data. M8 has not been dispatched against GitHub.

## Progress log

2026-10-28 M2: completed partial historical schemas, scoring, filtering, unknown-state rendering,
Fecha 0, persistence validation, and contributor documentation. `npm run validate` passed with
317 tests; `npm run test:e2e -- --workers=2` passed all 49 tests, including the four new partial-data
browser cases. `git diff --check` passed. No competition datasets, workflow triggers, commits, or
branches were changed by this implementation.

2026-10-28 follow-up: recorded the user-supplied run URL, 129-second Ollama installation,
and 0.53-second model-runner startup. Overall Actions job duration remains pending. Documentation
verification: `npm run validate` and `git diff --check` passed, including all 296 tests; no
application behavior changed and no application E2E run was required.

2026-10-28 M3 started: added versioned source and identity registry schemas/configuration,
explicit stage/season source priorities, edition mapping checks, evidence-backed candidates,
versioned proposals, publication/completeness gates, and exact reviewed identity resolution.
The ICPC Global directory and finder share one authority; no unverified edition mapping or
identity alias was invented. Focused ingestion tests pass. All 335 unit tests, lint, data
validation, type checking, production build, touched-file formatting, and `git diff --check`
passed. The aggregate `npm run validate` stopped at its repository-wide formatting step because
the user-owned, untracked `.vscode/settings.json` is unformatted; that file was left unchanged.
Follow-up added immutable dry-run reconciliation with row/field conflict and identity reports,
partial-run isolation, deterministic candidate ordering, a same-origin bounded fetcher with
explicit failure outcomes, candidate row/pagination coverage gates, a parser-connected bounded
cache, an acquisition API for fetch/render/parse candidates, `standings:ingest` for candidate
selection and atomic proposal output, and a generic bounded Playwright selected-state renderer.
Validation passed for touched-file formatting, repository lint, data validation, type checking,
all 377 unit tests, production build, and `git diff --check`.
The aggregate
`npm run validate` remains blocked only by the untracked, unformatted `.vscode/settings.json`, which
was not modified. Source-specific rendering/adapters, connected fetch/parse orchestration, and
cross-source completeness checks remain outstanding.

2026-10-28 M3 acquisition follow-up: added a policy-checked acquisition API and sequential batch
runner connecting bounded fetch/render, content-keyed parser caching, candidate validation, and
provenance stamping. Tests cover cache reuse, source-policy rejection, rendered-state parsing,
wrong-edition output, and partial batches. `npm run validate` passed with 377 tests.

2026-10-28 M4 started: added tested ICPC Mexico index/season discovery and a parse5 scoreboard
adapter. The parser preserves cell-level evidence and source-published totals, stages unknown
problem notation as totals-only, and marks row-count discrepancies incomplete; source IDs remain
null because none were found in the inspected page. Nine focused adapter tests and `npm run
validate` passed (386 total tests, including lint, data validation, typecheck, coverage, and
production build). Event-page scoreboard-link extraction and acquisition-CLI integration remain
the next implementation steps; no source records were imported.

2026-10-29 M4 follow-up: event-page scoreboard discovery accepts exactly one normalized
same-origin HTTPS destination and stages missing, external, or ambiguous links. Added the
`--acquire-icpc-mexico --season YEAR` CLI flow with optional series/stage filters, a 20-contest
limit, shared bounded acquisition/caching, and proposal-level failure reporting. Offline tests
cover successful index-to-scoreboard acquisition, external-link rejection, and season bounds.
`npm run validate` passed with 390 tests; `git diff --check` passed. No source records were
imported.

2026-10-29 M4 backfill follow-up: added inclusive `--season-from`/`--season-to` discovery capped
at five consecutive seasons, preserving the existing 20-contest total limit and proposal failure
reporting. Added offline coverage for a two-season run, invalid/reversed/oversized ranges,
provisional/live labels, and Masters staging. `npm run validate` passed with 392 tests;
`git diff --check` passed. No source records were imported.

2026-10-29 M4 cap follow-up: added a synthetic five-season discovery with 25 recognized contests.
The CLI fetches exactly 20 event pages and 20 scoreboards, writes 20 candidates, and records the
overflow as a proposal failure. `npm run validate` passed with 393 tests; `git diff --check`
passed. No source records were imported.

2026-10-29 M4 acceptance follow-up: explicitly excluded Masters and staged same-origin scoreboard
PDFs until M6; added a regression proving that non-Mexican schools are retained. The complete M4
acceptance checklist is verified. `npm run validate` passed with 394 tests, including formatting,
lint, data validation, type checking, coverage, and production build. No source records were
imported.

2026-10-29 M5 started: added offline ScoreLATAM index discovery for LATAM editions only, preserving
source labels separately from URL edition years and extracting played years only when explicit.
Added Mexico-group parsing that separates local and global ranks, verifies `/MX` membership,
deduplicates repeated source identities, and stages incomplete or invalid local rankings. Event
equivalence remains explicitly unverified and the extraction is not yet a candidate or wired into
the CLI. Focused ScoreLATAM tests pass; full validation is pending after this parser change. No
ScoreLATAM rows were imported.

2026-10-29 M5 acquisition follow-up: added `--acquire-scorelatam --season YEAR` with a bounded
same-origin fetch and ignored atomic extraction artifact. After maintainer approval of the
Mexico-local-to-Mexico-Finals equivalence, ready rows can become a `final` candidate; an unmapped
source edition remains a source failure with the artifact path, and no archive data is changed.
Offline CLI tests cover both the reviewed edition-mapping gate and mapped candidate construction.

2026-10-29 M5 equivalence approval: the maintainer approved mapping ScoreLATAM's Mexico-local
ranking to Mexico Finals. Candidate conversion uses Mexico-local places and retains LATAM place as
source evidence. `npm run validate` passed with 402 tests; `git diff --check` passed. Edition
mappings remain review-gated and no ScoreLATAM rows were imported.

2026-10-29 M5 completeness follow-up: pagination controls (`rel=next`, pagination/pager markers,
next/previous labels, or page-style query parameters) now stage the extraction with unknown
completeness instead of reporting a complete Mexico group. Static hidden group rows remain parsed.
`npm run validate` passed with 402 tests; `git diff --check` passed. No ScoreLATAM rows were
imported.

2026-10-29 M5 candidate follow-up: after the maintainer's equivalence approval, ready Mexico-group
rows now convert to a `mexico-finals`/`final` candidate through shared acquisition validation.
Mexico-local place is the candidate place; global LATAM rank remains evidence. A reviewed
per-edition source mapping is still required; an unmapped edition writes the staged extraction and
proposal failure without a candidate. `npm run validate` passed with 403 tests; `git diff --check`
passed. No archive data was changed.

2026-10-29 M5 edition-map follow-up: added explicit mappings for the LATAM editions listed by the
ScoreLATAM index, 2019-2025, including edition 2020 played in 2021. Unlisted labels remain unmapped;
candidate reconciliation remains review-only. `npm run validate` passed with 403 tests, and
`git diff --check` passed. No archive data was changed.

| Date       | Milestone | Update                                                                                                                                                                                                                                                                          | Verification / reference                                                                                                                                                                                                                                                                                                   |
| ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-27 | Planning  | Recorded agreed policies, source adapters, dependencies, acceptance criteria, and cross-machine handoff procedure.                                                                                                                                                              | Documentation only; no ingestion implementation yet.                                                                                                                                                                                                                                                                       |
| 2026-10-27 | M1        | Added locked integration harness, exact-value tests, offline CI checks, and manual hosted benchmark workflow; verified local DOM selection, text PDF, scanned PDF OCR, and three local Ollama extractions. Hosted measurements remain pending.                                  | 12 Python tests, final offline harness, workflow shell syntax, `npm run validate`, and `git diff --check` passed. See [spike report](standings-ingestion-spike.md).                                                                                                                                                        |
| 2026-10-28 | M1        | Recorded the supplied successful hosted benchmark and retained synthetic exact-match, 120-second, and 6-GiB gates. Run URL and installation/overall job timing remain pending; scheduling remains disabled.                                                                     | Supplied hosted report: exact rows in 3/3 runs, 21.86/8.52/8.55-second inference, 1.72-GiB sampled aggregate RSS. See [hosted measurements](standings-ingestion-spike.md#hosted-measurements).                                                                                                                             |
| 2026-10-29 | M6        | Started ITESO source discovery and bounded PDF/image acquisition, HTTPS origin upgrades, actual-type dispatch, a locked PyMuPDF/Tesseract bridge, deterministic multi-page table parsing, and atomic evidence staging. No season-standing candidate or archive data is emitted. | 27 focused ITESO/fetch/CLI tests, TypeScript checks, and Python syntax compilation passed. The local OCR runtime is unavailable; full validation and locked-Python document tests remain pending.                                                                                                                          |
| 2026-10-30 | M6        | Installed uv 0.9.22, the locked Python project, and user-local Tesseract 5.5/Chromium runtimes without system package changes. Fixed text-cell grouping and verified generated text, scan, and two-page PDFs through the ITESO helper.                                          | 12 Python tests, 27 focused TypeScript tests, and the full offline Playwright/PDF/OCR harness passed; generated OCR cells retained 0.96 confidence. No system packages or archive data changed.                                                                                                                            |
| 2026-10-30 | M7        | Completed ICPC Global directory/finder acquisition for the explicitly reviewed 2025/2026 editions, including bounded prior-year traversal, complete-table checks, ScoreLATAM fallback candidacy, and staged GPM document evidence. Unreviewed editions fail closed.             | Live 2025 run emitted a partial proposal with a complete 133-row ScoreLATAM candidate, raw Global Finals HTML with eight unranked rows, and staged GPM extraction; archive unchanged. `npm run validate` passed with 437 tests and 90.03% line coverage.                                                                   |
| 2026-10-31 | M8        | Added manual dry-run/source/edition dispatch, a variable-gated UTC weekly refresh, bounded dependency setup, proposal artifact retention, and append-only proposal PR publishing on a stable branch. Existing reviewer edits are preserved; no approval or merge occurs.        | Local integration covers stable-branch publishing, reviewer-edit preservation, rerun idempotency, unrelated-change rejection, PR comments, and explicit CI dispatch. `npm run validate` passed with 441 tests and 90.06% line coverage. Live GitHub PR/schedule exercise remains pending; schedule is disabled by default. |
