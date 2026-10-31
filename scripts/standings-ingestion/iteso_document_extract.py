"""Extract bounded ITESO PDF and image pages into cell-level source evidence."""

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path
from typing import TypedDict

import pdfplumber
import pypdfium2 as pdfium
import pytesseract
from PIL import Image

MAX_INPUT_BYTES = 64 * 1024 * 1024
MAX_PAGES = 80
MAX_PAGE_PIXELS = 25_000_000
MAX_OUTPUT_CHARS = 8_000_000
HEADER_ALIASES = {
    "place": {"#", "lugar", "posicion", "puesto", "place", "rank"},
    "team": {"equipo", "team", "school", "universidad", "institucion"},
    "score": {"punto", "puntos", "point", "points", "puntaje", "score", "acumulado"},
    "qualification": {
        "clasifica",
        "clasificacion",
        "califica",
        "calificacion",
        "qualified",
        "qualification",
        "avanza",
    },
}


class ExtractedWord(TypedDict):
    x: float
    y: float
    x0: float
    text: str
    line: object
    confidence: float | None


def normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value.lower())
    return re.sub(
        r"[^a-z0-9#]+",
        "",
        "".join(char for char in decomposed if unicodedata.category(char) != "Mn"),
    )


def group_words(words: list[ExtractedWord]) -> list[list[ExtractedWord]]:
    lines: list[list[ExtractedWord]] = []
    for word in sorted(words, key=lambda item: (item["y"], item["x0"])):
        same_ocr_line = (
            isinstance(word.get("line"), tuple)
            and lines
            and word.get("line") == lines[-1][0].get("line")
        )
        if lines and (same_ocr_line or abs(lines[-1][0]["y"] - word["y"]) <= 3):
            lines[-1].append(word)
        else:
            lines.append([word])
    return [sorted(line, key=lambda word: word["x0"]) for line in lines]


def locate_header(
    lines: list[list[ExtractedWord]],
) -> tuple[int, list[float], list[str]] | None:
    for line_index, line in enumerate(lines):
        found: dict[str, ExtractedWord] = {}
        for word in line:
            value = normalize(word["text"])
            for name, aliases in HEADER_ALIASES.items():
                if value in aliases:
                    found.setdefault(name, word)
        if all(name in found for name in ("place", "team", "score")):
            headers = sorted(found.items(), key=lambda item: item[1]["x"])
            centers = [item[1]["x"] for item in headers]
            cells = [""] * len(headers)
            for index, (_, word) in enumerate(headers):
                cells[index] = word["text"]
            return line_index, centers, cells
    return None


def split_lines(lines, header, active_centers=None):
    header_index, centers, header_cells = (
        header if header is not None else (None, active_centers, None)
    )
    if centers is None:
        return None, None
    rows = []
    if header_cells is not None:
        rows.append({"cells": header_cells, "confidences": [None] * len(centers)})
    for line_index, line in enumerate(lines):
        if line_index == header_index:
            continue
        if header_index is not None and line_index < header_index:
            continue
        cells: list[list[str]] = [[] for _ in centers]
        scores: list[list[float]] = [[] for _ in centers]
        for word in line:
            column = min(range(len(centers)), key=lambda index: abs(centers[index] - word["x"]))
            cells[column].append(word["text"])
            if word["confidence"] is not None:
                scores[column].append(word["confidence"])
        values = [" ".join(cell).strip() for cell in cells]
        if not any(values):
            continue
        confidences = [min(column_scores) if column_scores else None for column_scores in scores]
        rows.append({"cells": values, "confidences": confidences})
    return rows, centers


def pdf_words(page: pdfplumber.page.Page) -> list[ExtractedWord]:
    words: list[ExtractedWord] = []
    for item in page.extract_words():
        x0 = item["x0"]
        x1 = item["x1"]
        top = item["top"]
        bottom = item["bottom"]
        words.append(
            {
                "x": (x0 + x1) / 2,
                "y": (top + bottom) / 2,
                "x0": x0,
                "text": item["text"],
                "line": item.get("doctop"),
                "confidence": None,
            }
        )
    return words


def ocr_words(image: Image.Image) -> list[ExtractedWord]:
    data = pytesseract.image_to_data(
        image,
        config="--psm 6",
        timeout=60,
        output_type=pytesseract.Output.DICT,
    )
    words: list[ExtractedWord] = []
    for index, text in enumerate(data["text"]):
        if not text.strip():
            continue
        confidence = float(data["conf"][index]) / 100
        if confidence < 0:
            confidence = 0
        left = float(data["left"][index])
        width = float(data["width"][index])
        words.append(
            {
                "x": left + width / 2,
                "y": float(data["top"][index]) + float(data["height"][index]) / 2,
                "x0": left,
                "text": text,
                "line": (
                    int(data["block_num"][index]),
                    int(data["par_num"][index]),
                    int(data["line_num"][index]),
                ),
                "confidence": confidence,
            }
        )
    return words


def render_pdf_page(document, page_index):
    page = document[page_index]
    width, height = page.get_size()
    scale = 2
    if width * height * scale * scale > MAX_PAGE_PIXELS:
        scale = 1
    bitmap = page.render(scale=scale)
    image = bitmap.to_pil().convert("RGB")
    if image.width * image.height > MAX_PAGE_PIXELS:
        raise ValueError("Rendered page exceeds the OCR pixel limit")
    return image


def pdfplumber_tables(page):
    try:
        source_tables = page.extract_tables()
    except (AttributeError, ValueError):
        return []
    tables = []
    for source_table in source_tables:
        rows = []
        for source_row in source_table:
            cells = ["" if value is None else str(value).strip() for value in source_row]
            rows.append({"cells": cells, "confidences": [None] * len(cells)})
        if rows:
            tables.append({"rows": rows})
    return tables


def extract_pdf(path):
    if path.stat().st_size > MAX_INPUT_BYTES:
        raise ValueError("Document exceeds the input byte limit")
    with pdfplumber.open(path) as document:
        page_count = len(document.pages)
        if page_count < 1 or page_count > MAX_PAGES:
            raise ValueError(f"PDF page count must be between 1 and {MAX_PAGES}")
        raster_document = pdfium.PdfDocument(str(path))
        if len(raster_document) != page_count:
            raster_document.close()
            raise ValueError("PDF text and render page counts disagree")
        pages = []
        active_centers = None
        try:
            for page_index, page in enumerate(document.pages):
                text = (page.extract_text() or "")[:100_000]
                method = "text" if len(text.strip()) >= 20 else "ocr"
                words = (
                    pdf_words(page)
                    if method == "text"
                    else ocr_words(render_pdf_page(raster_document, page_index))
                )
                lines = group_words(words)
                header = locate_header(lines)
                if header is not None:
                    active_centers = header[1]
                tables = pdfplumber_tables(page) if method == "text" else []
                if not tables:
                    rows, active_centers = split_lines(lines, header, active_centers)
                    tables = [] if rows is None else [{"rows": rows}]
                pages.append(
                    {
                        "pageNumber": page_index + 1,
                        "method": method,
                        "text": text,
                        "tables": tables,
                    }
                )
        finally:
            raster_document.close()
        return {"version": 1, "pageCount": page_count, "pages": pages}


def extract_image(path):
    if path.stat().st_size > MAX_INPUT_BYTES:
        raise ValueError("Document exceeds the input byte limit")
    with Image.open(path) as image:
        if image.width * image.height > MAX_PAGE_PIXELS:
            raise ValueError("Image exceeds the OCR pixel limit")
        words = ocr_words(image.convert("RGB"))
    lines = group_words(words)
    header = locate_header(lines)
    rows, _centers = split_lines(lines, header)
    page = {"pageNumber": 1, "method": "ocr", "text": "", "tables": []}
    if rows is not None:
        page["tables"] = [{"rows": rows}]
    return {"version": 1, "pageCount": 1, "pages": [page]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--kind", choices=("pdf", "image"), required=True)
    args = parser.parse_args()
    result = extract_pdf(args.input) if args.kind == "pdf" else extract_image(args.input)
    output = json.dumps(result, ensure_ascii=False, separators=(",", ":"))
    if len(output) > MAX_OUTPUT_CHARS:
        raise ValueError("Extracted document exceeds the output character limit")
    sys.stdout.write(output)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"{type(error).__name__}: {error}", file=sys.stderr)
        sys.exit(1)
