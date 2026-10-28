import pytest

import spike
from spike import EXPECTED, Standings, verify


def test_exact_ground_truth():
    assert verify({"rows": EXPECTED}) == EXPECTED


@pytest.mark.parametrize(
    "rows",
    [
        EXPECTED[:1],
        EXPECTED[::-1],
        [*EXPECTED, EXPECTED[0]],
        [{**EXPECTED[0], "minute": 11}, EXPECTED[1]],
        [{**EXPECTED[0], "attempts": 0}, EXPECTED[1]],
    ],
)
def test_valid_shape_is_not_enough(rows):
    Standings.model_validate({"rows": rows})
    with pytest.raises(ValueError, match="ground truth"):
        verify({"rows": rows})


def test_types_are_not_silently_coerced():
    with pytest.raises(ValueError):
        verify({"rows": [{**EXPECTED[0], "place": "1"}, EXPECTED[1]]})


def test_archive_output_is_rejected(tmp_path):
    with pytest.raises(ValueError, match="subdirectory"):
        spike.run(tmp_path / "data")
    assert not (tmp_path / "data").exists()


def test_failure_report_is_persisted(tmp_path, monkeypatch):
    monkeypatch.setattr(spike, "OUTPUT_ROOT", tmp_path)

    def broken_capture():
        raise ValueError("Selected state unavailable")

    monkeypatch.setattr(spike, "capture", broken_capture)
    with pytest.raises(ValueError, match="Selected state unavailable"):
        spike.run(tmp_path / "failed", offline=True)
    report = spike.json.loads((tmp_path / "failed" / "report.json").read_text())
    assert report["status"] == "failed"
    assert "Selected state unavailable" in report["error"]


def test_existing_evidence_is_not_overwritten(tmp_path, monkeypatch):
    monkeypatch.setattr(spike, "OUTPUT_ROOT", tmp_path)
    existing = tmp_path / "existing"
    existing.mkdir()
    with pytest.raises(ValueError, match="already exists"):
        spike.run(existing, offline=True)


@pytest.mark.parametrize("changed_digest", [False, True])
def test_model_digest_and_selected_content_boundary(tmp_path, monkeypatch, changed_digest):
    monkeypatch.setattr(spike, "OUTPUT_ROOT", tmp_path)
    monkeypatch.setattr(spike, "capture", lambda: ("<table>selected</table>", "selected table"))
    monkeypatch.setattr(spike, "documents", lambda output: {"page": 1})
    received = []

    def fake_extract(markdown):
        received.append(markdown)
        return {"rows": EXPECTED}

    def fake_request(route, payload=None):
        if route == "/api/tags":
            return {"models": [{"name": spike.MODEL, "digest": "changed" if changed_digest else spike.MODEL_DIGEST}]}
        return {"version": "test", "license": "test", "model_info": {}}

    monkeypatch.setattr(spike, "extract", fake_extract)
    monkeypatch.setattr(spike, "json_request", fake_request)
    output = tmp_path / "model-test"
    if changed_digest:
        with pytest.raises(ValueError, match="Model tag changed"):
            spike.run(output)
        assert received == []
    else:
        spike.run(output)
        assert received == ["selected table"] * 3
    report = spike.json.loads((output / "report.json").read_text())
    assert report["status"] == ("failed" if changed_digest else "passed")
