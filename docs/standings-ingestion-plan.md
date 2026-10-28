# Standings ingestion implementation plan

Status: M1 in progress; local integration verified, hosted benchmark pending.

Created: 2026-10-27. Last updated: 2026-10-27.

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
| M2  | Partial historical standings model and UI               | None                     | pending     |
| M3  | Shared candidate, identity, and reconciliation pipeline | M1, M2                   | pending     |
| M4  | ICPC Mexico adapter                                     | M3                       | pending     |
| M5  | ScoreLATAM adapter                                      | M3                       | pending     |
| M6  | ITESO adapter and PDF/OCR extraction                    | M3                       | pending     |
| M7  | ICPC Global directory and finder adapters               | M3, M6 document pipeline | pending     |
| M8  | Reviewed-PR automation and controlled rollout           | M4, M5, M6, M7           | pending     |

### M1: Integration and cost feasibility spike

- [x] Pin a compatible PAR Scrape/Python environment and establish a reproducible installation.
- [x] Demonstrate that extraction receives the selected rendered state, not a fresh page that
      loses season selections, expanded accordions, or country filters.
- [x] Verify a JavaScript interaction, a text PDF, and a scanned-table OCR example.
- [ ] Benchmark a small Ollama model on standard hosted Linux against manually verified cells.
      Record runner resources, model identifier/digest, context limits, model download time,
      runtime, peak memory, extraction errors, and estimated weekly/backfill minutes.
- [ ] Choose explicit correctness and runtime acceptance thresholds from the benchmark; do not
      enable the schedule merely because the model returned valid JSON.
- [x] Document local setup, model licensing, cache needs, and the proposed integration boundary.

Implementation and local results are in the [M1 spike report](standings-ingestion-spike.md).
The manual-only hosted benchmark workflow is implemented but has not been dispatched. Local
inference passed all three exact-value checks; provisional 120-second and 6-GiB gates are
implemented, but the hosted measurements and final threshold decision remain unchecked above.

The repository is private: hosted usage consumes the account's included minutes and can incur
charges beyond its quota. Check current allowance and pricing before rollout. Start without a
rented GPU. Reconsider an existing self-hosted machine if measured runtime makes it cheaper;
self-hosting has hardware, electricity, maintenance, and trusted-runner implications.

### M2: Partial historical standings model and UI

- [ ] Extend the existing Zod schemas and inferred types with a distinct Fecha 0 stage.
- [ ] Represent detailed versus totals-only rows, including mixed-detail standings when needed.
- [ ] Represent unknown dates, duration, penalty rules, and qualification explicitly; do not
      fabricate values or interpret unknown qualification as `false`.
- [ ] Keep source-published totals as observations and computed totals authoritative for complete
      detailed results; define how mismatches block or stage publication.
- [ ] Preserve the convention that attempts include the accepted submission.
- [ ] Update repository validation, derived calculations, filters, tables/cards, and historical
      views. Unknown values must not render as zero or unattempted.
- [ ] Preserve existing complete-record behavior and test partial-data rendering/accessibility.
- [ ] Update the data model, product scope, and contribution guidance for the new shapes.

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

### M4: ICPC Mexico

Entry: <https://www.icpcmexico.org/contests>

- [ ] Traverse season groups and classify GPM season pages, Fecha 0, qualifiers 1-3, repechage,
      and Mexico Finals.
- [ ] Exclude training camps, Masters, LATAM championships, and unrelated events.
- [ ] Inspect each GPM season page for accumulated standings or outgoing result links; report
      missing standings explicitly rather than producing empty results.
- [ ] Parse DOM/structured data with intact cell boundaries. Do not parse flattened page text
      that merges adjacent numbers.
- [ ] Verify each layout's accepted/failed/unattempted notation and penalty rules.
- [ ] Dispatch linked PDFs through the document pipeline when available; otherwise explicitly
      stage those destinations until M6 is complete.
- [ ] Preserve official participant scope: GPM scoreboards may include non-Mexican schools.
- [ ] Test representative stages, a missing accumulated result, an external link, provisional
      data, and a source-layout change.

### M5: ScoreLATAM

Entry: <https://scorelatam.naquadah.com.br/>

- [ ] Discover editions under LATAM only, excluding PdA and other regional groups.
- [ ] Preserve edition labels independently of dates played, including the 2020 edition played
      in 2021.
- [ ] Apply the Mexico filter and obtain official Mexico-local placement.
- [ ] Independently verify membership using the exact `/MX` suffix in User/Site.
- [ ] Stage candidates if filtering retains LATAM ranks or official Mexico placement is
      unavailable; do not derive replacement places automatically.
- [ ] Deduplicate repeated table representations by source team identity and parse problem
      attempts/times and published totals.
- [ ] Preserve LATAM rank as evidence; confirm event equivalence before mapping Mexican
      participants to Mexico Finals.
- [ ] Test mixed countries, duplicate representations, ties, hidden/paginated rows, and absent
      local ranks.

### M6: ITESO and document extraction

Entry: <https://eventos.iteso.mx/acm/>

- [ ] Traverse sidebar season groups and identify accumulated GPM links using reviewed naming
      variants, preserving the season context.
- [ ] On each result page, follow the anchor enclosing the result image rather than downloading
      only its thumbnail.
- [ ] Resolve redirects and dispatch by actual response type, not URL extension alone.
- [ ] Extract text-PDF tables with page references; join multi-page tables and remove repeated
      headers without losing rows.
- [ ] Run local OCR for scanned PDFs/result images; preserve uncertain cells for review instead
      of silently correcting them.
- [ ] Preserve accumulated score units and qualification annotations; distinguish intermediate
      snapshots from the latest official result.
- [ ] Test text PDFs, scans, multi-page results, linked images, redirects, and ambiguous digits.

### M7: ICPC Global

Directory: <https://icpc.global/regionals/contests>

- [ ] Enumerate season choices, select each requested cycle, wait for refreshed content, and
      expand Latin America.
- [ ] Identify Mexican GPM/Mexico Finals from contest context and metadata, not loose name
      matching; follow the Standings-column destination when present.
- [ ] Route recognized HTML, unfamiliar rendered HTML, PDFs, and bounded landing-page discovery
      through the shared extractors; report missing buttons explicitly.

Finder: <https://icpc.global/regionals/finder/mexico>

- [ ] Record the displayed edition and collect the main See Standings link and GPM Contest List
      entry before visiting children.
- [ ] Follow the GPM entry to accumulated results, then follow See Prior Year from the saved
      edition context rather than relying on browser-back state.
- [ ] Stop when prior-year navigation is absent; detect repeated URLs/editions and enforce limits.
- [ ] Exclude Women's League, Masters, and training camps.

Shared acceptance:

- [ ] Map ICPC cycle labels and URL identifiers to Mexican edition years explicitly. The inspected
      2026 Mexico Finals page links to identifiers ending in `2027`; suffixes are not edition years.
- [ ] Deduplicate shared destinations discovered through directory and finder.
- [ ] Test season updates, historical navigation, missing standings, cycle mismatches, loops,
      unfamiliar external HTML, and PDF destinations.

### M8: Automation and rollout

- [ ] Add manual dispatch with source/edition filters, dry-run, and bounded backfill controls.
- [ ] Add a weekly schedule for current/previous editions, disabled by a repository variable until
      rollout passes; define the edition-boundary/timezone behavior explicitly.
- [ ] Use trusted default-branch execution, pinned dependencies/actions, scoped permissions,
      concurrency control, timeouts, and bounded artifact retention.
- [ ] Reuse the media workflow's reviewed-PR patterns where appropriate, after checking helpers
      for actual compatibility rather than assuming they are generic.
- [ ] Maintain a stable automation branch/PR without overwriting reviewer edits.
- [ ] Publish conflict-only proposals as well as additions. Include coverage, source failures,
      existing/proposed values, alternatives, partial-data/OCR warnings, unresolved identities,
      and evidence/version details in the PR.
- [ ] Validate proposed data and explicitly trigger required CI when token-generated events do
      not start it. Never approve or auto-merge.
- [ ] Verify a manual end-to-end PR, then small historical batches, then the weekly schedule.
- [ ] Document setup, cost controls, recovery, reruns, conflict resolution, and how to disable
      scheduling without changing or deleting archived data.

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

- **Next step:** merge the spike workflow into the default branch and manually dispatch
  `standings-spike.yml`. Record the run URL and hosted measurements in the spike report; confirm
  or revise the provisional gates before marking M1 done. M2 can proceed independently.
- **Blockers:** hosted benchmarking requires the workflow on the remote default branch and an
  Actions run. No schedule is enabled; no workflow dispatch, commit, or push was performed locally.
- **Implementation evidence:** locked Python environment, synthetic rendered-state/PDF/OCR checks,
  three successful local Ollama extractions, and failure-handling tests. See the spike report for
  portable results and limitations. Production site adapters are not implemented.

## Progress log

| Date       | Milestone | Update                                                                                                                                                                                                                                         | Verification / reference                                                                                                                                            |
| ---------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-27 | Planning  | Recorded agreed policies, source adapters, dependencies, acceptance criteria, and cross-machine handoff procedure.                                                                                                                             | Documentation only; no ingestion implementation yet.                                                                                                                |
| 2026-10-27 | M1        | Added locked integration harness, exact-value tests, offline CI checks, and manual hosted benchmark workflow; verified local DOM selection, text PDF, scanned PDF OCR, and three local Ollama extractions. Hosted measurements remain pending. | 12 Python tests, final offline harness, workflow shell syntax, `npm run validate`, and `git diff --check` passed. See [spike report](standings-ingestion-spike.md). |
