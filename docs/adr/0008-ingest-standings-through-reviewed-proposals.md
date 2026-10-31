# ADR 0008: Ingest standings through reviewed proposals

## Status

Accepted. Extends the repository-data architecture in
[ADR 0005](0005-serve-repository-data-without-a-backend.md) to standings acquisition. Reuses the
reviewed automation pattern from [ADR 0007](0007-ingest-media-through-reviewed-pull-requests.md)
without changing its media integration. Acceptance records the implemented architecture, not
completion of live workflow rollout.

## Decision

Acquire standings outside the browser through source-specific adapters for ICPC Mexico,
ScoreLATAM, ITESO, and ICPC Global. Keep orchestration in TypeScript scripts and domain schemas,
identity resolution, reconciliation, and archive materialization in the scoreboards feature.
The application continues to read repository JSON through its validated repository interface;
it never depends on source websites, extraction tools, or ingestion credentials.

Use bounded HTTPS fetching and explicit Playwright interactions for rendered sources. Parse known
HTML deterministically. Isolate PDF text/table extraction and local OCR behind a typed, bounded
Python process boundary using a separately locked pdfplumber/PDFium/Tesseract environment.
PAR Scrape/Ollama and PyMuPDF remain feasibility-harness dependencies, not the production extraction
path. Review bundled dependency licenses before redistribution.

Treat source content and extracted values as untrusted. Use Zod schemas and inferred domain types
to validate candidates and versioned review proposals. Retain source URLs, content hashes, parser
versions, original cell evidence, coverage, and uncertainty. Require explicit reviewed edition
mappings and exact source-identity aliases; never infer Mexican edition years from URL suffixes
or merge teams/schools by fuzzy names. Missing historical values remain explicitly unknown.

Reconcile contest and accumulated season-standing candidates against the real archive without
mutating it. Report conflicts, source failures, and unresolved identities instead of overwriting
existing records. Non-final or incomplete candidates cannot propose additions. Independent eligible
candidates may remain reviewable in a partial run, but run-level validation failures block additions.
Source removal or missing upstream rows never authorizes archive deletion.

Run acquisition manually or on a controlled, disabled-by-default schedule through GitHub Actions
on trusted default-branch code. Scope built-in token writes to the ingestion job. Publish append-only
proposal JSON on a stable automation branch, preserve reviewer edits, and explicitly dispatch CI
because token-generated pushes/PR events do not start normal checks automatically. Keep downloaded
and staged diagnostic evidence in bounded-retention artifacts. Never auto-approve or auto-merge.

Generate archive-shaped drafts as a separate, non-publishing operation. Re-run reconciliation using
current configuration and aliases rather than trusting saved addition references. Emit complete
eligible records only, refuse existing archive targets and competing candidates, validate drafts
composed with the current dataset, and write fresh bundles under an ignored directory that cannot
redirect into the archive. Include blocked-record reports and review warnings in workflow artifacts.

Proposal PRs contain review evidence, not published competition records. Reviewers promote approved
draft files through a separate archive PR with normal validation and human review. Schools, teams,
and identity aliases still require explicit reviewed records; draft generation never invents them.
Keep the real archive separate from synthetic mock data.

## Consequences

The site remains static with no ingestion backend or browser credentials. Source outages and parser
failures leave existing archive data intact, and acquisition can be reproduced from versioned
configuration and evidence. Shared schemas protect both CI and the application's repository boundary.

This is not an unattended importer or real-time standings service. Operators maintain source
adapters, reviewed edition mappings, and identity registries. Missing source IDs, incomplete tables,
ambiguous OCR, competing candidates, and archive corrections can require manual decisions or
transcription. Schema validity and high OCR confidence are not substitutes for source verification.

Drafting removes mechanical conversion work but adds a separate review/promotion step. Merging a
proposal PR alone does not publish standings. Evidence artifacts expire, so decision-critical values
and locators remain in versioned proposals; source redistribution permissions still apply.

Hosted execution consumes Actions minutes and artifact storage. Explicit request/page/size/time
budgets constrain cost and failure scope, while conservative eligibility checks can stage data that
a reviewer could otherwise import. Live manual publication, required-check compatibility, and small
historical batches must be verified before enabling scheduled refreshes.

See the [GitHub Actions operator guide](../standings-ingestion.md) for inputs, artifact review,
draft promotion, recovery, and scheduling, and the [data model](../data-model.md) for domain rules.
