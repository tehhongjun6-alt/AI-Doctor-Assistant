from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import re
import sys
from typing import Any, Dict, Iterable, List, Optional, Tuple, Union

from medora_rag.extract import PageData, extract_pdf_pages


@dataclass
class TextUnit:
    """A sentence or paragraph unit with provenance metadata."""
    text: str
    word_count: int
    page_number: int
    section: str
    is_para_start: bool = False


# Headings that mark sections to skip (Cover, TOC, Committee Lists, References, etc.)
_SKIP_SECTION_PATTERNS = [
    re.compile(r"^cover\b", re.I),
    re.compile(r"^title\s+page\b", re.I),
    re.compile(r"^published\s+by\b", re.I),
    re.compile(r"^table\s+of\s+contents\b", re.I),
    re.compile(r"^contents$", re.I),
    re.compile(r"^foreword\b", re.I),
    re.compile(r"^preface\b", re.I),
    re.compile(r"^statement\s+of\s+intent\b", re.I),
    re.compile(r"^updating\s+the\s+cpg\b", re.I),
    re.compile(r"^review\s+of\s+the\s+guidelines\b", re.I),
    re.compile(r"^terms\s+of\s+reference\b", re.I),
    re.compile(r"^levels?\s+of\s+evidence\b", re.I),
    re.compile(r"^grades?\s+of\s+recommendation", re.I),
    re.compile(r"\bdevelopment\s+group\b", re.I),
    re.compile(r"\bworking\s+group\b", re.I),
    re.compile(r"\breview\s+committee\b", re.I),
    re.compile(r"\bexternal\s+reviewers?\b", re.I),
    re.compile(r"\bguidelines?\s+reviewers?\b", re.I),
    re.compile(r"\bmembers\s+of\s+the\s+expert\s+panel\b", re.I),
    re.compile(r"\bexpert\s+panel\b", re.I),
    re.compile(r"\bcommittee\s+members?\b", re.I),
    re.compile(r"\bwriting\s+committee\b", re.I),
    re.compile(r"^references?\b", re.I),
    re.compile(r"^bibliography\b", re.I),
    re.compile(r"^list\s+of\s+abbreviations\b", re.I),
    re.compile(r"^abbreviations$", re.I),
    re.compile(r"^acknowledgements?\b", re.I),
    re.compile(r"example\s+of\s+search\s+strategy", re.I),
    re.compile(r"^search\s+strategy\b", re.I),
]

# Standalone major headings (case-insensitive, must start with uppercase or be ALL-CAPS)
_EXPLICIT_HEADINGS = {
    "table of contents",
    "contents",
    "key recommendations",
    "summary of recommendations",
    "foreword",
    "preface",
    "statement of intent",
    "updating the cpg",
    "review of the guidelines",
    "terms of reference",
    "guidelines development and objectives",
    "objectives",
    "rationale",
    "development group",
    "clinical practice guidelines development group",
    "guidelines development group",
    "hypertension guideline working group",
    "review committee",
    "external reviewers",
    "external reviewers (in alphabetical order)",
    "clinical practice guidelines reviewers",
    "members of the expert panel",
    "committee members",
    "writing committee",
    "grades of recommendation and level of evidence",
    "levels of evidence",
    "references",
    "bibliography",
    "appendices",
    "list of abbreviations",
    "abbreviations",
    "acknowledgement",
    "acknowledgements",
    "discharge criteria",
    "implementing the guidelines",
}

_SENTENCE_VERBS = {
    "is", "are", "was", "were", "be", "been", "should", "must", "can", "could",
    "may", "might", "will", "would", "have", "has", "had", "do", "does", "did",
}


def compute_content_hash(content: str) -> str:
    """Compute SHA-256 hex digest of chunk content."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def is_skipped_section(section_title: str) -> bool:
    """Return True if the section title corresponds to Cover, TOC, References, or Committee lists."""
    norm = re.sub(r"\s+", " ", section_title.strip()).strip(":.- ")
    if not norm:
        return False
    for pat in _SKIP_SECTION_PATTERNS:
        if pat.search(norm):
            return True
    return False


def _is_references_section(section_title: str) -> bool:
    norm = section_title.strip().lower().rstrip(":")
    return norm in ("references", "reference", "bibliography") or norm.startswith("references ")


def _is_toc_page(page_number: int, text: str) -> bool:
    """Detect Table of Contents pages by header, dot-leader density, or TOC page-range lists."""
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    if not lines:
        return False
    first_few = " ".join(lines[:4]).lower()
    if "table of contents" in first_few:
        return True
    dot_lines = sum(1 for l in lines if re.search(r"\.{4,}\s*\d+$", l))
    if dot_lines >= 4:
        return True
    if page_number <= 25:
        range_lines = sum(1 for l in lines if re.match(r"^\d{1,3}\s*[-–]\s*\d{1,3}$", l))
        if range_lines >= 4:
            return True
        sec_lines = sum(
            1 for l in lines
            if re.match(r"^(?:\d+\.\d+|(?:section|chapter|appendix)\s+\d*\b)", l, re.I)
        )
        avg_words = sum(len(l.split()) for l in lines) / len(lines)
        if sec_lines >= 6 and avg_words < 6.5:
            return True
    return False


def _is_cover_or_boilerplate_page(page_number: int, text: str) -> bool:
    """Detect cover page, blank page, ISBN back cover, or committee roster page."""
    words = text.split()
    if len(words) < 12:
        return True
    lower = text.lower()
    if page_number <= 3 and ("published by" in lower or "all rights reserved" in lower or "statement of intent" in lower):
        if len(words) < 250:
            return True
    if "e isbn" in lower and len(words) < 30:
        return True
    return False


def _merge_multiline_headings(lines: List[str]) -> List[str]:
    """
    Merge split two-line headings common in MaHTAS PDFs, such as:
      Line i:   '1.'
      Line i+1: 'INTRODUCTION'
    or:
      Line i:   'Appendix 1'
      Line i+1: 'EXAMPLE OF SEARCH STRATEGY'
    """
    merged: List[str] = []
    i = 0
    n = len(lines)
    while i < n:
        cur = lines[i].strip()
        if i + 1 < n:
            nxt = lines[i + 1].strip()
            # Case 1: '1.' followed by 'INTRODUCTION'
            if re.match(r"^\d{1,2}\.$", cur) and nxt and len(nxt) <= 75:
                if nxt.isupper() or (nxt[0].isupper() and len(nxt.split()) <= 8 and not nxt.endswith(".")):
                    merged.append(f"{cur} {nxt}")
                    i += 2
                    continue
            # Case 2: 'SECTION 3' / 'Appendix 5' followed by title line
            if re.match(r"^(?:SECTION|CHAPTER|APPENDIX)\s+\d+:?$", cur, re.I) and nxt and len(nxt) <= 85:
                if nxt.isupper() or (nxt[0].isupper() and len(nxt.split()) <= 10 and not nxt.endswith(".")):
                    merged.append(f"{cur.rstrip(':')}: {nxt}")
                    i += 2
                    continue
        merged.append(lines[i])
        i += 1
    return merged


def detect_section_heading(line: str, in_references: bool = False) -> Optional[str]:
    """
    Determine if a line is a section heading. Returns the cleaned heading title or None.
    When `in_references` is True, single-level mixed-case reference citations (e.g. '1. Author et al.')
    are not treated as section headings, while multi-level headings ('7.2 ...') or ALL-CAPS headings
    ('8. INPATIENT MANAGEMENT') still start a new section.
    """
    s = line.strip()
    if not s or len(s) > 100:
        return None

    # 1. Markdown heading: # Heading
    md_match = re.match(r"^#{1,6}\s+(.+)$", s)
    if md_match:
        return md_match.group(1).strip()

    if not (s[0].isupper() or s[0].isdigit()):
        return None

    norm_lower = re.sub(r"\s+", " ", s.lower()).rstrip(":")

    # 2. Explicit standalone heading
    if norm_lower in _EXPLICIT_HEADINGS and s[0].isupper():
        return s.rstrip(":")

    # 3. CHAPTER / SECTION / APPENDIX / ALGORITHM / KEY MESSAGES
    if re.match(r"^(?:chapter|section|appendix)\s+\d+(?:\s*$|(?:\s*[\.:\-–]\s*|\s+)[A-Z][^\)]*$)", s, re.I):
        if len(s.split()) <= 16:
            return s
    if re.match(r"^algorithm\s+\d+\s*[\.:\-–]?\s+[A-Z]", s, re.I):
        if len(s.split()) <= 16:
            return s
    if re.match(r"^key\s+(?:messages?|recommendations?)\s*#\d+", s, re.I):
        if len(s.split()) <= 16:
            return s

    # Avoid matching citations or sentences
    if "et al" in norm_lower or "http://" in norm_lower or "https://" in norm_lower:
        return None

    # 4. Multi-level numbered heading: e.g. '3.1 Initial assessment', '4.1.1 Blood Pressure Target'
    multi_match = re.match(r"^(\d{1,2}\.\d{1,2}(?:\.\d{1,2})?)\.?\s+([A-Z][A-Za-z0-9\s,\-\(\)/&–':]{2,75})$", s)
    if multi_match and not s.endswith("."):
        words = multi_match.group(2).split()
        if 1 <= len(words) <= 10 and not any(w.lower() in _SENTENCE_VERBS for w in words):
            return f"{multi_match.group(1)} {multi_match.group(2).strip()}"

    # 5. Single-level numbered heading: e.g. '1. INTRODUCTION' or '2. Risk Factors'
    single_match = re.match(r"^(\d{1,2})\.\s+([A-Z][A-Za-z0-9\s,\-\(\)/&–':]{2,70})$", s)
    if single_match and not s.endswith("."):
        num_str = single_match.group(1)
        title_part = single_match.group(2).strip()
        words = title_part.split()
        if title_part.isupper() and 1 <= len(words) <= 10:
            return f"{num_str}. {title_part}"
        if not in_references and 1 <= len(words) <= 6 and not any(w.lower() in _SENTENCE_VERBS for w in words):
            return f"{num_str}. {title_part}"

    return None


def _split_paragraph_into_units(
    para_text: str,
    page_number: int,
    section: str,
    max_unit_words: int = 45,
) -> List[TextUnit]:
    """Split a paragraph into sentence-level TextUnits, capping max words per unit."""
    text = re.sub(r"\s+", " ", para_text).strip()
    if not text:
        return []

    raw_sentences = re.split(r"(?<=[.!?])\s+", text)
    units: List[TextUnit] = []
    first_in_para = True

    for sent in raw_sentences:
        words = sent.split()
        if not words:
            continue
        if len(words) <= max_unit_words:
            units.append(
                TextUnit(
                    text=" ".join(words),
                    word_count=len(words),
                    page_number=page_number,
                    section=section,
                    is_para_start=first_in_para,
                )
            )
            first_in_para = False
        else:
            step = 35
            for start in range(0, len(words), step):
                sub_words = words[start : start + step]
                units.append(
                    TextUnit(
                        text=" ".join(sub_words),
                        word_count=len(sub_words),
                        page_number=page_number,
                        section=section,
                        is_para_start=first_in_para,
                    )
                )
                first_in_para = False

    return units


def extract_units_from_pages(
    pages: Iterable[Union[PageData, Dict[str, Any]]],
    max_unit_words: int = 45,
) -> List[TextUnit]:
    """
    Parse pages into section-annotated TextUnits while skipping Cover, Table of Contents,
    References, and Committee Roster sections.
    """
    page_list: List[PageData] = [
        p if isinstance(p, PageData) else PageData(page_number=int(p["page_number"]), text=str(p["text"]))
        for p in pages
    ]

    units: List[TextUnit] = []
    current_section = "General"
    last_clinical_section = "General"
    in_references = False

    for page in page_list:
        pno = page.page_number
        text = page.text.strip()
        if not text:
            continue
        if _is_toc_page(pno, text) or _is_cover_or_boilerplate_page(pno, text):
            continue

        raw_lines = [l.strip() for l in text.split("\n")]
        lines = _merge_multiline_headings(raw_lines)
        non_empty_top = [l for l in lines if l][:3]

        # If previous page ended in a footnote 'References', check if this page is actually a bibliography page
        if in_references and non_empty_top:
            looks_like_bib = any(
                _is_references_section(l)
                or re.match(r"^\d{1,3}\.?\s+[A-Z]", l)
                or "et al" in l.lower()
                for l in non_empty_top
            )
            if not looks_like_bib:
                current_section = last_clinical_section
                in_references = False

        para_lines: List[str] = []

        def flush_para() -> None:
            if not para_lines:
                return
            joined = " ".join(para_lines).strip()
            para_lines.clear()
            if not joined or is_skipped_section(current_section):
                return
            units.extend(_split_paragraph_into_units(joined, pno, current_section, max_unit_words=max_unit_words))

        for line in lines:
            if not line:
                flush_para()
                continue

            heading = detect_section_heading(line, in_references=in_references)
            if heading is not None:
                flush_para()
                current_section = heading
                in_references = _is_references_section(heading)
                if not is_skipped_section(heading):
                    last_clinical_section = heading
                continue

            para_lines.append(line)

        flush_para()

    return units


def _render_units(units: List[TextUnit]) -> str:
    """Render a list of TextUnits back into paragraph-formatted text."""
    if not units:
        return ""
    parts: List[str] = [units[0].text]
    for u in units[1:]:
        if u.is_para_start:
            parts.append("\n\n" + u.text)
        else:
            parts.append(" " + u.text)
    return "".join(parts)


def _dominant_section(units: List[TextUnit], overlap_unit_count: int = 0) -> str:
    """Determine the primary section title for a chunk (preferring non-overlap units)."""
    core_units = units[overlap_unit_count:] if overlap_unit_count < len(units) else units
    counts: Dict[str, int] = {}
    for u in core_units:
        counts[u.section] = counts.get(u.section, 0) + u.word_count
    if not counts:
        return units[0].section if units else "General"
    return max(counts.items(), key=lambda kv: kv[1])[0]


def _build_overlap_units(emitted_units: List[TextUnit], overlap_words: int) -> List[TextUnit]:
    """
    Extract ~overlap_words from the tail of `emitted_units` to seed the next chunk.
    Prefers whole sentence units when their sum falls in [overlap_words - 15, overlap_words + 15];
    otherwise slices exact `overlap_words` from the tail.
    """
    if overlap_words <= 0 or not emitted_units:
        return []

    selected: List[TextUnit] = []
    total = 0
    low = max(1, overlap_words - 15)
    high = overlap_words + 15

    for u in reversed(emitted_units):
        if total + u.word_count <= high:
            selected.append(u)
            total += u.word_count
            if total >= low:
                break
        else:
            break

    if low <= total <= high and selected:
        selected.reverse()
        result = [
            TextUnit(
                text=u.text,
                word_count=u.word_count,
                page_number=u.page_number,
                section=u.section,
                is_para_start=(idx == 0 or u.is_para_start),
            )
            for idx, u in enumerate(selected)
        ]
        return result

    # Fallback: take exact `overlap_words` words from the end of emitted_units
    tail_words: List[Tuple[str, int, str]] = []
    for u in reversed(emitted_units):
        u_words = u.text.split()
        for w in reversed(u_words):
            tail_words.append((w, u.page_number, u.section))
            if len(tail_words) >= overlap_words:
                break
        if len(tail_words) >= overlap_words:
            break

    tail_words.reverse()
    if not tail_words:
        return []

    # Group contiguous tail words by page_number so page_start/page_end stay exact
    grouped: List[TextUnit] = []
    cur_words: List[str] = []
    cur_page = tail_words[0][1]
    cur_sec = tail_words[0][2]

    for w, pno, sec in tail_words:
        if pno != cur_page:
            grouped.append(
                TextUnit(
                    text=" ".join(cur_words),
                    word_count=len(cur_words),
                    page_number=cur_page,
                    section=cur_sec,
                    is_para_start=(len(grouped) == 0),
                )
            )
            cur_words = [w]
            cur_page = pno
            cur_sec = sec
        else:
            cur_words.append(w)

    if cur_words:
        grouped.append(
            TextUnit(
                text=" ".join(cur_words),
                word_count=len(cur_words),
                page_number=cur_page,
                section=cur_sec,
                is_para_start=(len(grouped) == 0),
            )
        )

    return grouped


def chunk_pages(
    doc_id: str,
    pages: Iterable[Union[PageData, Dict[str, Any]]],
    min_words: int = 300,
    max_words: int = 500,
    overlap_words: int = 50,
) -> List[Dict[str, Any]]:
    """
    Convert extracted pages into overlapping chunks of [min_words, max_words] words.
    Each chunk contains:
      doc_id, chunk_index, page_start, page_end, section, content, content_hash
    """
    units = extract_units_from_pages(pages, max_unit_words=min(45, max(15, max_words // 8)))
    if not units:
        return []

    # Calculate suffix word sums to avoid leaving a tiny trailing remainder
    suffix_words = [0] * (len(units) + 1)
    for i in range(len(units) - 1, -1, -1):
        suffix_words[i] = suffix_words[i + 1] + units[i].word_count

    target_words = (min_words + max_words) // 2
    emitted_chunks: List[Tuple[List[TextUnit], int]] = []

    current_units: List[TextUnit] = []
    current_words = 0
    overlap_unit_count = 0

    def emit_current() -> None:
        nonlocal current_units, current_words, overlap_unit_count
        if not current_units:
            return
        emitted_chunks.append((current_units, overlap_unit_count))
        overlap = _build_overlap_units(current_units, overlap_words)
        current_units = overlap
        current_words = sum(u.word_count for u in current_units)
        overlap_unit_count = len(current_units)

    for idx, unit in enumerate(units):
        remaining_after = suffix_words[idx + 1]

        # 1. If a new section begins and we already have >= min_words, flush at section boundary
        if current_words >= min_words and len(current_units) > overlap_unit_count:
            prev_sec = current_units[-1].section
            if unit.section != prev_sec and remaining_after + unit.word_count >= min_words // 2:
                emit_current()

        # 2. If adding this unit would exceed max_words
        if current_words + unit.word_count > max_words:
            if current_words >= min_words:
                emit_current()
            else:
                # Split the unit to hit target_words
                needed = max(1, target_words - current_words)
                u_words = unit.text.split()
                part1_words = u_words[:needed]
                part2_words = u_words[needed:]
                if part1_words:
                    current_units.append(
                        TextUnit(
                            text=" ".join(part1_words),
                            word_count=len(part1_words),
                            page_number=unit.page_number,
                            section=unit.section,
                            is_para_start=unit.is_para_start,
                        )
                    )
                    current_words += len(part1_words)
                emit_current()
                if part2_words:
                    current_units.append(
                        TextUnit(
                            text=" ".join(part2_words),
                            word_count=len(part2_words),
                            page_number=unit.page_number,
                            section=unit.section,
                            is_para_start=False,
                        )
                    )
                    current_words += len(part2_words)
                continue

        # 3. Add the unit
        current_units.append(unit)
        current_words += unit.word_count

        # 4. If we reached target_words at a paragraph boundary, emit (unless the rest of the doc fits in max_words)
        next_is_boundary = (idx + 1 < len(units)) and (
            units[idx + 1].is_para_start or units[idx + 1].section != unit.section
        )
        if (
            current_words >= target_words
            and next_is_boundary
            and remaining_after > 0
            and (current_words + remaining_after > max_words)
        ):
            emit_current()

    # Emit final remaining units if they contain new content beyond the overlap prefix
    if len(current_units) > overlap_unit_count or (not emitted_chunks and current_units):
        emitted_chunks.append((current_units, overlap_unit_count))

    results: List[Dict[str, Any]] = []
    for chunk_idx, (c_units, ov_count) in enumerate(emitted_chunks):
        content = _render_units(c_units)
        page_start = min(u.page_number for u in c_units)
        page_end = max(u.page_number for u in c_units)
        section = _dominant_section(c_units, overlap_unit_count=ov_count)
        results.append(
            {
                "doc_id": doc_id,
                "chunk_index": chunk_idx,
                "page_start": page_start,
                "page_end": page_end,
                "section": section,
                "content": content,
                "content_hash": compute_content_hash(content),
            }
        )

    return results


def process_all_guidelines(
    manifest_path: Optional[Path] = None,
    raw_dir: Optional[Path] = None,
    chunks_dir: Optional[Path] = None,
) -> List[Dict[str, Any]]:
    """
    Extract and chunk all 6 MOH CPG PDFs listed in manifest.json.
    Writes `data/chunks/<doc_id>.jsonl` and prints summary statistics.
    """
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    base_dir = Path(__file__).resolve().parent.parent
    if manifest_path is None:
        manifest_path = base_dir / "data" / "manifest.json"
    if raw_dir is None:
        raw_dir = base_dir / "data" / "raw"
    if chunks_dir is None:
        chunks_dir = base_dir / "data" / "chunks"

    chunks_dir.mkdir(parents=True, exist_ok=True)

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    stats: List[Dict[str, Any]] = []
    print(f"{'doc_id':<16} {'Pages':>6} {'Chunks':>8} {'Avg Words':>11} {'Min Words':>10} {'Max Words':>10}")
    print("-" * 66)

    for item in manifest:
        doc_id = item["doc_id"]
        pdf_path = raw_dir / f"{doc_id}.pdf"
        pages = extract_pdf_pages(pdf_path, strip_headers=True)
        chunks = chunk_pages(doc_id, pages)

        out_path = chunks_dir / f"{doc_id}.jsonl"
        with open(out_path, "w", encoding="utf-8") as out_f:
            for c in chunks:
                out_f.write(json.dumps(c, ensure_ascii=False) + "\n")

        word_counts = [len(c["content"].split()) for c in chunks]
        avg_words = sum(word_counts) / len(word_counts) if word_counts else 0.0
        min_w = min(word_counts) if word_counts else 0
        max_w = max(word_counts) if word_counts else 0

        print(f"{doc_id:<16} {len(pages):>6} {len(chunks):>8} {avg_words:>11.1f} {min_w:>10} {max_w:>10}")
        stats.append(
            {
                "doc_id": doc_id,
                "pages": len(pages),
                "chunks": len(chunks),
                "avg_words": round(avg_words, 1),
                "min_words": min_w,
                "max_words": max_w,
            }
        )

    total_chunks = sum(s["chunks"] for s in stats)
    print("-" * 66)
    print(f"Total chunks across {len(stats)} guidelines: {total_chunks}")
    return stats


if __name__ == "__main__":
    process_all_guidelines()
