"""Isolated feasibility harness; never reads or writes the competition archive."""

import argparse
import hashlib
import importlib.metadata
import json
import os
import platform
import threading
import time
import urllib.request
from pathlib import Path

import psutil
import pymupdf
import pytesseract
from PIL import Image, ImageDraw, ImageFont
from pydantic import BaseModel, ConfigDict

ROOT = Path(__file__).resolve().parent
OUTPUT_ROOT = ROOT.parents[1] / ".standings-spike"
OLLAMA = "http://127.0.0.1:11434"
MODEL = "qwen2.5:1.5b"
MODEL_DIGEST = "65ec06548149b04c096a120e4a6da9d4017ea809c91734ea5631e89f96ddc57b"
CONTEXT = 4096
EXPECTED = [
    {"place": 1, "team": "Fixture Alpha", "attempts": 1, "minute": 10, "solved": 1, "penalty": 10},
    {"place": 2, "team": "Fixture Beta", "attempts": 2, "minute": 30, "solved": 1, "penalty": 50},
]
TABLE = "Place Team A-attempts A-minute Solved Penalty\n1 Fixture Alpha 1 10 1 10\n2 Fixture Beta 2 30 1 50"


class Row(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    place: int
    team: str
    attempts: int
    minute: int
    solved: int
    penalty: int


class Standings(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    rows: list[Row]


def json_request(route, payload=None):
    body = None if payload is None else json.dumps(payload).encode()
    request = urllib.request.Request(
        OLLAMA + route, data=body, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(request, timeout=600) as response:
        return json.load(response)


def capture():
    from par_ai_core.web_tools import html_to_markdown
    from playwright.sync_api import sync_playwright

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        try:
            page = browser.new_page()
            page.goto((ROOT / "fixture.html").as_uri())
            page.select_option("#edition", label="2026")
            page.click("#region")
            page.select_option("#country", label="Mexico")
            page.get_by_role("heading", name="Synthetic Mexico 2026").wait_for()
            # Pass the selected DOM directly to PAR's converter/extractor. No second navigation.
            html = page.locator("#standings").evaluate("(element) => element.outerHTML")
            markdown = html_to_markdown(html)
            if "Decoy" in markdown or "Fixture Beta" not in markdown:
                raise ValueError("Selected rendered state was not preserved")
            return html, markdown
        finally:
            browser.close()


def documents(output):
    text_path = output / "synthetic-text.pdf"
    scan_path = output / "synthetic-scan.pdf"
    with pymupdf.open() as document:
        document.new_page().insert_text((30, 50), TABLE, fontsize=14)
        document.save(text_path)
    # Original generated image: no external copyrighted fixture or archive record.
    image = Image.new("RGB", (1800, 360), "white")
    font = ImageFont.truetype("DejaVuSansMono.ttf", 28)
    ImageDraw.Draw(image).multiline_text((30, 30), TABLE, fill="black", font=font, spacing=20)
    image.save(output / "synthetic-table.png")
    with pymupdf.open() as document:
        document.new_page(width=900, height=180).insert_image(
            pymupdf.Rect(0, 0, 900, 180), filename=str(output / "synthetic-table.png")
        )
        document.save(scan_path)
    with pymupdf.open(text_path) as document:
        text = document[0].get_text()
    with pymupdf.open(scan_path) as document:
        if document[0].get_text().strip():
            raise ValueError("Scan fixture unexpectedly has a text layer")
        pixmap = document[0].get_pixmap(matrix=pymupdf.Matrix(2, 2))
        rendered = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
    ocr = pytesseract.image_to_data(
        rendered, config="--psm 6", timeout=60, output_type=pytesseract.Output.DICT
    )
    words = [
        {"text": word, "confidence": float(confidence)}
        for word, confidence in zip(ocr["text"], ocr["conf"], strict=True)
        if word.strip()
    ]
    ocr_text = " ".join(word["text"] for word in words)
    for label, content in (("text PDF", text), ("scanned PDF", ocr_text)):
        if content.split() != TABLE.split():
            raise ValueError(f"{label} differs from exact synthetic ground truth: {content!r}")
    return {
        "text": text,
        "ocr": ocr_text,
        "page": 1,
        "ocr_words": words,
        "review_required": any(word["confidence"] < 90 for word in words),
    }


def verify(result):
    actual = Standings.model_validate(result).model_dump()["rows"]
    if actual != EXPECTED:
        raise ValueError(f"Extraction differs from exact ground truth: {actual!r}")
    return actual


def extract(markdown):
    from par_ai_core.llm_config import LlmConfig
    from par_ai_core.llm_providers import LlmProvider
    from par_scrape.scrape_data import format_data

    return format_data(
        data=markdown,
        dynamic_listings_container=Standings,
        llm_config=LlmConfig(
            provider=LlmProvider.OLLAMA,
            model_name=MODEL,
            base_url=OLLAMA,
            temperature=0,
            streaming=False,
            timeout=300,
            num_ctx=CONTEXT,
            num_predict=1024,
            seed=42,
        ),
        extraction_prompt=ROOT / "prompt.txt",
    ).model_dump()


def sample_memory(stop, samples):
    # Aggregate RSS, not unique memory. Includes runner-local Ollama and its model workers.
    while not stop.is_set():
        processes = [psutil.Process(), *psutil.Process().children(recursive=True)]
        for process in psutil.process_iter(["name"]):
            if "ollama" in (process.info["name"] or "").lower():
                processes.append(process)
        total = 0
        for process in {process.pid: process for process in processes}.values():
            try:
                total += process.memory_info().rss
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue  # Short-lived processes may exit between enumeration and measurement.
        samples.append(total)
        stop.wait(0.1)


def run(output, offline=False, repetitions=3, weekly_pages=20, backfill_pages=500):
    output = output.resolve()
    if not output.is_relative_to(OUTPUT_ROOT.resolve()) or output == OUTPUT_ROOT.resolve():
        raise ValueError("Output must be a new subdirectory of repository .standings-spike/")
    if output.exists():
        raise ValueError("Output directory already exists; choose a fresh run directory")
    output.mkdir(parents=True)
    report = {
        "status": "running",
        "synthetic": True,
        "hosted": os.environ.get("GITHUB_ACTIONS") == "true",
        "platform": platform.platform(),
        "cpu": platform.processor(),
        "logical_cpus": psutil.cpu_count(),
        "memory_bytes": psutil.virtual_memory().total,
        "versions": {
            name: importlib.metadata.version(name)
            for name in ("par-scrape", "par-ai-core", "playwright", "pymupdf", "pytesseract")
        },
        "python": platform.python_version(),
        "model": MODEL,
        "context": CONTEXT,
        "extraction_options": {"temperature": 0, "seed": 42, "num_predict": 1024},
        "thresholds": {
            "exact_rows": EXPECTED,
            "max_inference_seconds": 120,
            "max_aggregate_rss_bytes": 6 * 1024**3,
        },
        "weekly_pages_assumption": weekly_pages,
        "backfill_pages_assumption": backfill_pages,
    }
    stop = threading.Event()
    samples = []
    monitor = threading.Thread(target=sample_memory, args=(stop, samples), daemon=True)
    started = time.monotonic()
    monitor.start()
    try:
        html, markdown = capture()
        (output / "selected.html").write_text(html)
        (output / "selected.md").write_text(markdown)
        report["content_sha256"] = hashlib.sha256(markdown.encode()).hexdigest()
        report["prompt_sha256"] = hashlib.sha256((ROOT / "prompt.txt").read_bytes()).hexdigest()
        report["documents"] = documents(output)
        report["llm_runs"] = []
        if not offline:
            report["ollama_version"] = json_request("/api/version")
            pull_started = time.monotonic()
            json_request("/api/pull", {"model": MODEL, "stream": False})
            report["model_pull_seconds"] = time.monotonic() - pull_started
            models = json_request("/api/tags")["models"]
            report["model_metadata"] = next(model for model in models if model["name"] == MODEL)
            if report["model_metadata"]["digest"] != MODEL_DIGEST:
                raise ValueError("Model tag changed; review and update the pinned digest before use")
            show = json_request("/api/show", {"model": MODEL})
            report["model_license"] = show.get("license")
            report["model_info"] = show.get("model_info")
            report["model_digest"] = report["model_metadata"]["digest"]
            for index in range(repetitions):
                before = time.monotonic()
                result = extract(markdown)
                (output / f"extracted-{index + 1}.json").write_text(json.dumps(result, indent=2))
                rows = verify(result)
                report["llm_runs"].append({"seconds": time.monotonic() - before, "rows": rows})
            slowest = max(run["seconds"] for run in report["llm_runs"])
            report["projections"] = {
                "weekly_inference_minutes": slowest * weekly_pages / 60,
                "backfill_inference_minutes": slowest * backfill_pages / 60,
                "excludes": "installation, discovery, network, larger tables, PDF/OCR and PR/CI",
            }
            if slowest > 120:
                raise ValueError("Synthetic-page inference exceeded the provisional 120-second gate")
            if max(samples, default=0) > 6 * 1024**3:
                raise ValueError("Benchmark exceeded the provisional 6-GiB aggregate RSS gate")
        report["status"] = "offline-passed" if offline else "passed"
    except Exception as error:
        report["status"] = "failed"
        report["error"] = f"{type(error).__name__}: {error}"
        raise
    finally:
        stop.set()
        monitor.join()
        report["elapsed_seconds"] = time.monotonic() - started
        report["peak_aggregate_rss_bytes"] = max(samples, default=0)
        report["host_available_memory_bytes"] = psutil.virtual_memory().available
        (output / "report.json").write_text(json.dumps(report, indent=2) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--offline", action="store_true", help="No Ollama; not an inference benchmark")
    parser.add_argument("--repetitions", type=int, default=3)
    parser.add_argument("--weekly-pages", type=int, default=20)
    parser.add_argument("--backfill-pages", type=int, default=500)
    args = parser.parse_args()
    if min(args.repetitions, args.weekly_pages, args.backfill_pages) < 1:
        parser.error("repetitions and page assumptions must be positive")
    run(args.output.resolve(), args.offline, args.repetitions, args.weekly_pages, args.backfill_pages)


if __name__ == "__main__":
    main()
