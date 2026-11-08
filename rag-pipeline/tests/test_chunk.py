import hashlib
import re
from medora_rag.extract import PageData, remove_repeated_headers_footers
from medora_rag.chunk import chunk_pages, compute_content_hash


def _make_paragraph(topic: str, sentence_count: int = 8, start_idx: int = 1) -> str:
    """Generate a synthetic clinical paragraph with deterministic word count (~120-160 words)."""
    sentences = []
    for i in range(start_idx, start_idx + sentence_count):
        sentences.append(
            f"Clinical observation {i} regarding {topic} indicates that adult patients presenting "
            f"with persistent symptoms require structured hemodynamic assessment and serial laboratory monitoring."
        )
    return " ".join(sentences)


def test_chunk_word_count_in_range():
    """Every chunk must be within 300-500 words, except the last chunk which may be shorter."""
    pages = [
        PageData(
            page_number=1,
            text="\n\n".join([
                "1. INTRODUCTION",
                _make_paragraph("dengue fever pathophysiology", sentence_count=10, start_idx=1),
                _make_paragraph("vascular permeability changes", sentence_count=10, start_idx=11),
            ]),
        ),
        PageData(
            page_number=2,
            text="\n\n".join([
                _make_paragraph("warning signs and triage", sentence_count=10, start_idx=21),
                _make_paragraph("fluid resuscitation protocol", sentence_count=10, start_idx=31),
            ]),
        ),
        PageData(
            page_number=3,
            text="\n\n".join([
                _make_paragraph("inpatient monitoring criteria", sentence_count=6, start_idx=41),
            ]),
        ),
    ]

    chunks = chunk_pages("synthetic_doc", pages, min_words=300, max_words=500, overlap_words=50)
    assert len(chunks) >= 3

    for c in chunks[:-1]:
        wc = len(c["content"].split())
        assert 300 <= wc <= 500, f"Non-final chunk {c['chunk_index']} has {wc} words (expected 300..500)"

    last_wc = len(chunks[-1]["content"].split())
    assert 1 <= last_wc <= 500, f"Final chunk has {last_wc} words (expected <= 500)"


def test_adjacent_chunks_overlap():
    """Adjacent chunks must share ~50 overlapping words at their boundary."""
    pages = [
        PageData(
            page_number=1,
            text="\n\n".join([
                "1. MANAGEMENT OF HYPERTENSION",
                _make_paragraph("blood pressure measurement", sentence_count=12, start_idx=1),
                _make_paragraph("lifestyle modification", sentence_count=12, start_idx=13),
                _make_paragraph("pharmacological therapy", sentence_count=12, start_idx=25),
            ]),
        ),
    ]

    chunks = chunk_pages("hypertension_test", pages, min_words=300, max_words=500, overlap_words=50)
    assert len(chunks) >= 2

    for c1, c2 in zip(chunks, chunks[1:]):
        words1 = c1["content"].split()
        words2 = c2["content"].split()

        overlap_len = 0
        for k in range(min(80, len(words1), len(words2)), 0, -1):
            if words1[-k:] == words2[:k]:
                overlap_len = k
                break

        assert 35 <= overlap_len <= 65, (
            f"Expected ~50 words overlap between chunk {c1['chunk_index']} and {c2['chunk_index']}, "
            f"got {overlap_len}"
        )


def test_cross_page_chunk_page_numbers():
    """Chunks spanning across pages must have page_start < page_end."""
    pages = [
        PageData(
            page_number=1,
            text="\n\n".join([
                "1. CLINICAL ASSESSMENT",
                _make_paragraph("initial patient history", sentence_count=10, start_idx=1),
            ]),
        ),
        PageData(
            page_number=2,
            text="\n\n".join([
                _make_paragraph("physical examination findings", sentence_count=10, start_idx=11),
            ]),
        ),
    ]

    chunks = chunk_pages("page_span_test", pages, min_words=300, max_words=500, overlap_words=50)
    assert len(chunks) >= 1
    first_chunk = chunks[0]
    assert first_chunk["page_start"] == 1
    assert first_chunk["page_end"] == 2
    assert first_chunk["page_start"] < first_chunk["page_end"]


def test_references_and_non_clinical_sections_skipped():
    """Cover, Table of Contents, Committee lists, and References sections must be skipped."""
    pages = [
        PageData(
            page_number=1,
            text="MANAGEMENT OF ASTHMA IN ADULTS\nSecond Edition 2024",
        ),
        PageData(
            page_number=2,
            text=(
                "TABLE OF CONTENTS\n"
                "1. Introduction .................... 4\n"
                "2. Diagnosis ....................... 8\n"
                "3. Management ...................... 12\n"
                "References ......................... 40"
            ),
        ),
        PageData(
            page_number=3,
            text=(
                "DEVELOPMENT GROUP\n"
                "Chairperson: Dr. Ahmad bin Ali, Consultant Pulmonologist, Hospital Kuala Lumpur.\n"
                "Members: Dr. Siti Aminah, Family Medicine Specialist, Ministry of Health Malaysia.\n"
                "REVIEW COMMITTEE\n"
                "Prof. Dr. Tan Mei Ling, Senior Consultant Physician."
            ),
        ),
        PageData(
            page_number=4,
            text="\n\n".join([
                "1. DIAGNOSIS AND MANAGEMENT",
                _make_paragraph("spirometry and reversibility testing", sentence_count=10, start_idx=1),
                _make_paragraph("inhaled corticosteroid controller therapy", sentence_count=10, start_idx=11),
            ]),
        ),
        PageData(
            page_number=5,
            text=(
                "REFERENCES\n"
                "1. Reddel HK, Bacharier LB, Bateman ED, et al. Global Initiative for Asthma Strategy 2024.\n"
                "2. Bateman ED, Hurd SS, Barnes PJ, et al. Global strategy for asthma management and prevention.\n"
                "3. O'Byrne PM, FitzGerald JM, Bateman ED, et al. Inhaled combined budesonide-formoterol."
            ),
        ),
    ]

    chunks = chunk_pages("skip_test", pages, min_words=300, max_words=500, overlap_words=50)
    assert len(chunks) >= 1

    for c in chunks:
        assert c["section"] == "1. DIAGNOSIS AND MANAGEMENT"
        lower_content = c["content"].lower()
        assert "reddel hk" not in lower_content
        assert "table of contents" not in lower_content
        assert "chairperson" not in lower_content
        assert c["page_start"] == 4
        assert c["page_end"] == 4


def test_content_hash_deterministic():
    """Identical content must always yield the exact same 64-character SHA-256 content_hash."""
    pages = [
        PageData(
            page_number=1,
            text="\n\n".join([
                "1. TREATMENT TARGETS",
                _make_paragraph("glycemic control targets", sentence_count=10, start_idx=1),
                _make_paragraph("cardiovascular risk reduction", sentence_count=10, start_idx=11),
            ]),
        ),
    ]

    chunks_run_1 = chunk_pages("hash_test", pages)
    chunks_run_2 = chunk_pages("hash_test", pages)

    assert len(chunks_run_1) == len(chunks_run_2)
    for c1, c2 in zip(chunks_run_1, chunks_run_2):
        assert c1["content"] == c2["content"]
        assert c1["content_hash"] == c2["content_hash"]
        assert re.match(r"^[0-9a-f]{64}$", c1["content_hash"])
        expected = hashlib.sha256(c1["content"].encode("utf-8")).hexdigest()
        assert c1["content_hash"] == expected
        assert compute_content_hash(c1["content"]) == expected


def test_remove_repeated_headers_footers():
    """Repeated page headers/footers and standalone page numbers are removed across pages."""
    raw_pages = [
        PageData(page_number=i, text=f"{i}\nManagement of Dengue In Adults\nClinical content on page {i}.\nMOH Malaysia 2026")
        for i in range(1, 6)
    ]
    cleaned = remove_repeated_headers_footers(raw_pages)
    assert len(cleaned) == 5
    for idx, p in enumerate(cleaned, start=1):
        assert p.page_number == idx
        assert "Management of Dengue In Adults" not in p.text
        assert "MOH Malaysia 2026" not in p.text
        assert f"Clinical content on page {idx}." in p.text
