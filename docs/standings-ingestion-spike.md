# Standings ingestion feasibility spike (M1)

This is a synthetic integration and cost experiment, not an archive importer. It never requests
the competition sites or writes competition data. See the [living plan](standings-ingestion-plan.md)
for milestone status and the remaining production work.

## Reproducible environment

- Node 24 and npm 11 for the repository commands.
- [uv 0.9.22](https://github.com/astral-sh/uv/releases/tag/0.9.22), Python 3.12
  (uv can download it), and the committed
  [Python lockfile](../scripts/standings-spike/uv.lock).
- PAR Scrape 0.11.0, PAR AI Core 0.5.9, Python Playwright 1.64.1, PyMuPDF 1.26.5,
  pytesseract 0.3.13, Pillow 12.0.0, and psutil 7.1.2.
- Tesseract with English language data and the DejaVu Sans Mono font.
- [Ollama 0.13.5](https://github.com/ollama/ollama/releases/tag/v0.13.5), listening only on
  `127.0.0.1:11434`, with `qwen2.5:1.5b` (Q4_K_M), a 4096-token context, seed 42,
  temperature 0, and a 1024-token output budget.
- Expected model manifest digest:
  `65ec06548149b04c096a120e4a6da9d4017ea809c91734ea5631e89f96ddc57b`.
  The harness fails if the mutable model tag resolves to another digest.

Python Playwright is intentionally separate from the application's npm Playwright dependency.
PAR AI Core requires Python Playwright >=1.60; pinning it to the application's older version
failed dependency resolution. Do not change the application's browser tooling to accommodate this
isolated experiment.

### Local setup (Ubuntu)

Install uv and Ollama from the linked versioned releases following their platform instructions.
The benchmark workflow verifies checksums before executing those downloaded tools. System
dependencies on a machine you administer can be installed with:

```sh
sudo apt-get update
sudo apt-get install -y tesseract-ocr tesseract-ocr-eng fonts-dejavu-core
nvm use
npm ci
uv sync --locked --project scripts/standings-spike
uv run --locked --project scripts/standings-spike playwright install --with-deps chromium
uv run --locked --project scripts/standings-spike pytest scripts/standings-spike
```

Verify rendering, PDF text extraction, and OCR without a model:

```sh
npm run standings:spike -- --offline --output .standings-spike/offline-1
```

For inference, start a dedicated local Ollama server in another terminal. Do not replace or
terminate another user's existing service. Use a separate model directory if appropriate:

```sh
OLLAMA_HOST=127.0.0.1:11434 \
OLLAMA_MODELS="$PWD/.standings-spike/models" \
OLLAMA_NO_CLOUD=1 OLLAMA_NUM_PARALLEL=1 \
ollama serve
```

Once `/api/version` responds, run:

```sh
curl --fail http://127.0.0.1:11434/api/version
npm run standings:spike -- --output .standings-spike/local-1
```

The harness pulls the pinned model tag and verifies its digest. Stop the dedicated server when
finished. Output must be a **fresh subdirectory** of repository `.standings-spike/`; existing
evidence is never overwritten. Inspect `report.json`, `selected.html`, `selected.md`,
`extracted-*.json`, and the generated PDFs/image there. The ignored virtual environment, models,
and evidence do not travel between machines; the source, lockfile, and recorded results do.

## Integration boundary proven

The local fixture starts with the wrong edition/country and a collapsed region. Playwright
selects edition 2026, expands Latin America, selects Mexico, and waits for the selected table.
The adapter captures that table's DOM and passes it directly to PAR AI Core's `html_to_markdown`
and PAR Scrape's `format_data`. It does **not** call the URL-based scrape API again.

`format_data` is a pinned lower-level interface, not the provisional public URL-based API.
Keep this dependency inside the integration boundary and re-run the spike when upgrading it.
Extraction uses an explicit Pydantic schema and local Ollama only. No provider keys, GitHub token,
external model endpoint, or browser storage are needed.

For this bounded experiment the harness is Python-only, invoked through npm; it does not add
domain normalization or reconciliation in Python. M3 still owns TypeScript orchestration and
the typed process boundary for production adapters.

The generated text PDF contains a known two-row table. A separate generated image is embedded
into an image-only PDF whose absence of a text layer is checked before OCR. Both extracted token
streams must match the original text exactly; OCR words retain confidence and page evidence.
These simple clean fixtures demonstrate the boundary, not general multi-page document accuracy.

## Local measurements

Recorded on 2026-10-27. **These are not GitHub-hosted-runner measurements.**

| Item                         | Observed value                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------- |
| Host                         | Linux x86_64, AMD Ryzen 7 4800H, 16 logical CPUs, approximately 15 GiB RAM        |
| Runtime                      | Python 3.12.12, Ollama 0.13.5, locked dependencies above                          |
| Model download               | 986,061,892-byte model; pull took 80.04 seconds on the first successful model run |
| First extraction             | 44.96 seconds, including client/model cold-start work                             |
| Subsequent extractions       | 23.84 and 24.62 seconds                                                           |
| Correctness                  | All 3 runs exactly matched both teams and all 6 fields per row                    |
| PDF / OCR                    | Both matched the original token stream; OCR word confidences 92-96                |
| Peak aggregate RSS           | 1,882,062,848 bytes (approximately 1.75 GiB)                                      |
| Harness elapsed time         | 175.03 seconds, including model pull but excluding dependency/Ollama installation |
| 20-page weekly assumption    | 14.99 inference minutes using the slowest observed run                            |
| 500-page backfill assumption | 374.63 inference minutes using the slowest observed run                           |

These are extrapolations from a tiny synthetic page, **not workload or billing forecasts**.
They exclude discovery, network, larger tables, chunking, PDF/OCR, tool installation, and PR/CI.
Model download time depends on network and cache state. Aggregate RSS is sampled every 100 ms
and includes the harness, children, and visible Ollama processes; it is not unique memory or a
kernel-level peak and may include other local Ollama processes.

The successful run's Markdown SHA-256 was
`22a007a7a127880397b17b0d4249d44621016ad3bbb2e814925a1103ab95751c`.
Its raw evidence remains in the ignored local run directory, so the portable results are recorded
above. System packages were not installed on the shared development machine: Tesseract and its
libraries were extracted locally for verification. The dedicated Ollama process was stopped.

Verification completed locally:

- `uv run --locked --project scripts/standings-spike pytest scripts/standings-spike`: 12 passed,
  including strict value/type checks, selected-content forwarding, model digest drift,
  archive-path rejection, preserved evidence, and persisted failure reports.
- Final offline harness: passed rendered-state selection, text-PDF extraction, and scanned-PDF OCR.
- All five workflow shell steps passed `bash -n`; YAML triggers were checked. This does not
  substitute for executing the workflow on Actions.
- `npm run validate`: passed, including formatting, lint, data validation, type checking,
  coverage tests, and build. No application behavior changed, so no browser application E2E run
  was required.
- `git diff --check`: passed. Temporary downloaded tool archives were removed; installed ignored
  tools, the model cache, and evidence were retained for reuse. No Ollama listener was left running.

### Provisional gates and limitations

Based on that local baseline, require:

- Every expected row and field exactly correct in every repetition, with no extras or omissions.
- Text-PDF and scanned-PDF output exactly matching the known fixture tokens.
- No more than 120 seconds per synthetic-page extraction.
- No more than 6 GiB sampled aggregate RSS for the inference run.
- A failing exit status and persisted failure report for an extraction or gate failure.

These are initial feasibility gates, not permission to schedule production ingestion. M1 remains
in progress until a standard hosted runner confirms or revises them with measurements. Real,
large scoreboards will need bounded chunking, row-completeness checks, and fixture coverage in
later milestones; a 4096-token context is not assumed to fit a complete historical scoreboard.

## Hosted benchmark and CI

[Standings feasibility benchmark](../.github/workflows/standings-spike.yml) runs offline unit,
rendered-state, PDF, and OCR checks for changes to the spike. Only manual dispatch from the
default branch starts Ollama inference. It has read-only repository permissions, no schedule,
no PR publishing, no secrets, and a 30-minute timeout.

After the workflow is merged into the default branch:

```sh
gh workflow run standings-spike.yml
gh run list --workflow standings-spike.yml --limit 5
gh run view RUN_ID
gh run download RUN_ID --name standings-feasibility-evidence
```

The seven-day artifact contains offline and inference reports, selected content, synthetic
documents, extraction results, Ollama installation timing, and the server log. Record the run URL,
runner CPU/memory, model digest, download/startup timing, inference errors/times, memory, and
revised cost assumptions here before completing M1. Check overall job duration too: harness time
excludes setup. The benchmark intentionally does not cache the approximately 1-GB model; measure
cold-start cost before choosing a storage/cache policy.

The private repository uses included Actions minutes and storage, then potentially paid usage.
Check the account's remaining quota and current pricing before dispatching or enabling any
future schedule. This experiment supplies timing estimates, not a monetary price quote.

## Licensing and retention

PAR Scrape is MIT-licensed. The pulled model reports Apache-2.0 terms; the full returned license
is retained in each inference report. Confirm the model digest/license again when changing it.
PyMuPDF uses AGPL/commercial licensing: it is an isolated spike dependency, **not an approved
production PDF-library decision**. Review licensing or replace it with a suitable alternative
before adopting/distributing the production document pipeline in M6.

The harness generates its own clearly synthetic fixture and documents; it never promotes them to
`data/`. Do not upload real competition documents or private content to external model services.
Retain only bounded diagnostic evidence, and remove named obsolete run directories/models
deliberately rather than deleting broad workspace directories.
