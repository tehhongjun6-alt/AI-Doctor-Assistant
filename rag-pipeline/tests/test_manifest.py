import json
import re
from pathlib import Path
import pytest


@pytest.fixture
def manifest_data():
    base_dir = Path(__file__).resolve().parent.parent
    manifest_path = base_dir / "data" / "manifest.json"
    assert manifest_path.exists(), f"manifest.json not found at {manifest_path}"
    with open(manifest_path, "r", encoding="utf-8") as f:
        return json.load(f)


def test_manifest_entry_count(manifest_data):
    """Manifest must have exactly 6 entries."""
    assert len(manifest_data) == 6, f"Expected 6 entries, got {len(manifest_data)}"


def test_manifest_unique_doc_ids(manifest_data):
    """All doc_id values must be unique."""
    doc_ids = [item.get("doc_id") for item in manifest_data]
    assert len(doc_ids) == len(set(doc_ids)), f"Duplicate doc_ids found: {doc_ids}"


def test_manifest_expected_doc_ids(manifest_data):
    """Doc IDs must match the expected 6 CPG targets."""
    expected_ids = {"dengue", "t2dm", "hypertension", "asthma", "ckd", "dyslipidaemia"}
    actual_ids = {item.get("doc_id") for item in manifest_data}
    assert actual_ids == expected_ids, f"Doc IDs mismatch. Expected: {expected_ids}, got: {actual_ids}"


def test_manifest_required_fields(manifest_data):
    """Each entry must contain doc_id, title, edition_year, source_url, and sha256."""
    required_keys = {"doc_id", "title", "edition_year", "source_url", "sha256"}
    for item in manifest_data:
        missing = required_keys - set(item.keys())
        assert not missing, f"Item {item.get('doc_id')} missing keys: {missing}"
        assert item["title"].strip(), f"Item {item.get('doc_id')} has empty title"


def test_manifest_source_urls(manifest_data):
    """All source URLs must begin with https://."""
    for item in manifest_data:
        url = item.get("source_url", "")
        assert url.startswith("https://"), (
            f"Item {item.get('doc_id')} url does not start with https://: {url}"
        )


def test_manifest_sha256_format(manifest_data):
    """sha256 must be a 64-character hexadecimal string."""
    sha256_pattern = re.compile(r"^[a-f0-9]{64}$", re.IGNORECASE)
    for item in manifest_data:
        sha = item.get("sha256", "")
        assert sha256_pattern.match(sha), (
            f"Item {item.get('doc_id')} invalid sha256: {sha}"
        )


def test_manifest_edition_years(manifest_data):
    """edition_year must be a valid integer between 2000 and 2030."""
    for item in manifest_data:
        year = item.get("edition_year")
        assert isinstance(year, int), f"Item {item.get('doc_id')} year is not an int: {year}"
        assert 2000 <= year <= 2030, f"Item {item.get('doc_id')} year out of range: {year}"
