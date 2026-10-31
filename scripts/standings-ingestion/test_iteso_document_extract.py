from pathlib import Path

import iteso_document_extract as extractor
import pytest
from iteso_document_extract import extract_image, extract_pdf
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


def draw_table_page(pdf_canvas, rows):
    pdf_canvas.drawString(40, 760, "Lugar")
    pdf_canvas.drawString(110, 760, "Equipo")
    pdf_canvas.drawString(350, 760, "Puntos")
    pdf_canvas.drawString(460, 760, "Clasifica")
    for index, row in enumerate(rows):
        y = 730 - index * 24
        pdf_canvas.drawString(40, y, row[0])
        pdf_canvas.drawString(110, y, row[1])
        pdf_canvas.drawString(350, y, row[2])
        pdf_canvas.drawString(460, y, row[3])


def test_extract_pdf_joins_pages_and_preserves_text_table_cells(tmp_path: Path):
    pdf_path = tmp_path / "multi-page.pdf"
    pdf_canvas = canvas.Canvas(str(pdf_path), pagesize=(612, 792))
    draw_table_page(pdf_canvas, [["1", "Equipo Alfa", "12.5", "Sí"]])
    pdf_canvas.showPage()
    draw_table_page(pdf_canvas, [["2", "Equipo Beta", "9.25", "No"]])
    pdf_canvas.save()

    document = extract_pdf(pdf_path)

    assert document["pageCount"] == 2
    assert [page["method"] for page in document["pages"]] == ["text", "text"]
    assert [
        table["rows"][1]["cells"] for table in (page["tables"][0] for page in document["pages"])
    ] == [
        ["1", "Equipo Alfa", "12.5", "Sí"],
        ["2", "Equipo Beta", "9.25", "No"],
    ]


def make_scan() -> Image.Image:
    image = Image.new("RGB", (1500, 300), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=40)
    draw.text(
        (40, 20),
        "Lugar          Equipo                    Puntos       Clasifica",
        fill="black",
        font=font,
    )
    draw.text(
        (40, 100),
        "1                 Equipo Alfa                12.5              Si",
        fill="black",
        font=font,
    )
    return image


def test_extract_pdf_and_image_ocr(tmp_path: Path):
    image_path = tmp_path / "scan.png"
    make_scan().save(image_path)
    pdf_path = tmp_path / "scan.pdf"
    pdf_canvas = canvas.Canvas(str(pdf_path), pagesize=(750, 150))
    pdf_canvas.drawImage(ImageReader(str(image_path)), 0, 0, width=750, height=150)
    pdf_canvas.save()

    pdf_document = extract_pdf(pdf_path)
    image_document = extract_image(image_path)

    assert pdf_document["pages"][0]["method"] == "ocr"
    assert image_document["pages"][0]["method"] == "ocr"
    pdf_rows = pdf_document["pages"][0]["tables"][0]["rows"]
    image_rows = image_document["pages"][0]["tables"][0]["rows"]
    assert pdf_rows[1]["cells"] == ["1", "Equipo Alfa", "12.5", "Si"]
    assert image_rows[1]["cells"] == ["1", "Equipo Alfa", "12.5", "Si"]
    assert min(pdf_rows[1]["confidences"]) >= 0.9
    assert min(image_rows[1]["confidences"]) >= 0.9


@pytest.mark.parametrize("extract", [extract_pdf, extract_image])
def test_rejects_oversized_input(tmp_path, monkeypatch, extract):
    source = tmp_path / "oversized"
    source.write_bytes(b"too large")
    monkeypatch.setattr(extractor, "MAX_INPUT_BYTES", 1)
    with pytest.raises(ValueError, match="input byte limit"):
        extract(source)


def test_unrecognized_header_does_not_invent_a_table():
    assert extractor.locate_header([]) is None
    assert extractor.split_lines([], None) == (None, None)


@pytest.mark.parametrize("kind", ["pdf", "image"])
def test_cli_outputs_extraction_and_enforces_output_limit(monkeypatch, capsys, kind):
    monkeypatch.setattr("sys.argv", ["extractor", "--input", "source", "--kind", kind])
    monkeypatch.setattr(extractor, f"extract_{kind}", lambda source: {"version": 1})
    extractor.main()
    assert capsys.readouterr().out == '{"version":1}'
    monkeypatch.setattr(extractor, "MAX_OUTPUT_CHARS", 1)
    with pytest.raises(ValueError, match="output character limit"):
        extractor.main()
