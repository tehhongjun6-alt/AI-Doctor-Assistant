from collections import Counter
from dataclasses import dataclass
from pathlib import Path
import re
from typing import Any, Dict, Iterable, List, Set, Union
import pymupdf


@dataclass
class PageData:
    """Represents extracted text for a single 1-based PDF page."""
    page_number: int
    text: str

    def __getitem__(self, key: str) -> Any:
        return getattr(self, key)

    def get(self, key: str, default: Any = None) -> Any:
        return getattr(self, key, default)


_BULLET_TRANSLATION = str.maketrans({
    "\uf0b7": "•",
    "\uf06c": "•",
    "\uf0a7": "•",
    "\uf0d8": "•",
    "\uf0fc": "•",
    "\uf076": "•",
    "": "•",
    "": "•",
    "\xa0": " ",
})

_PAGE_NUM_RE = re.compile(
    r"^(?:\d{1,4}|[ivxlcdm]{1,6}|page\s+\d+(?:\s+of\s+\d+)?)$",
    re.IGNORECASE,
)


def clean_page_text(raw_text: str) -> str:
    """Normalize line endings, special bullet glyphs, and whitespace."""
    if not raw_text:
        return ""
    text = raw_text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.translate(_BULLET_TRANSLATION)

    cleaned_lines: List[str] = []
    blank_Streak = 0
    for line in text.split("\n"):
        # Collapse multiple tabs/spaces inside a line
        norm_line = re.sub(r"[ \t]+", " ", line).strip()
        if not norm_line:
            blank_Streak += 1
            if blank_Streak <= 1:
                cleaned_lines.append("")
        else:
            blank_Streak = 0
            cleaned_lines.append(norm_line)

    return "\n".join(cleaned_lines).strip()


def _normalize_header_key(line: str) -> str:
    """Normalize a line for header/footer frequency comparison."""
    return re.sub(r"\s+", " ", line.strip()).lower()


def _is_standalone_page_number(line: str) -> bool:
    return bool(_PAGE_NUM_RE.match(line.strip()))


def remove_repeated_headers_footers(
    pages: Iterable[Union[PageData, Dict[str, Any]]],
    window: int = 4,
) -> List[PageData]:
    """
    Remove repeated headers, footers, and standalone page numbers across pages.
    - Document-wide repeated headers/footers (>= 30% of pages, min 3) are removed from all pages.
    - Running chapter/section headers (>= 4 pages when total >= 10, else >= 3) are kept on their
      first occurrence so section headings are preserved, and removed on subsequent pages.
    - Standalone page numbers at the very top or bottom of a page are removed.
    """
    page_list: List[PageData] = [
        p if isinstance(p, PageData) else PageData(page_number=int(p["page_number"]), text=str(p["text"]))
        for p in pages
    ]
    total_pages = len(page_list)
    if total_pages == 0:
        return []

    top_counts: Counter = Counter()
    bottom_counts: Counter = Counter()

    if total_pages >= 3:
        for page in page_list:
            non_empty = [l.strip() for l in page.text.split("\n") if l.strip()]
            top_seen = set()
            for l in non_empty[:window]:
                if not _is_standalone_page_number(l):
                    top_seen.add(_normalize_header_key(l))
            for k in top_seen:
                top_counts[k] += 1

            bottom_seen = set()
            for l in non_empty[-window:]:
                if not _is_standalone_page_number(l):
                    bottom_seen.add(_normalize_header_key(l))
            for k in bottom_seen:
                bottom_counts[k] += 1

    global_threshold = max(3, int(total_pages * 0.30))
    running_threshold = 4 if total_pages >= 10 else 3

    global_top = {k for k, c in top_counts.items() if c >= global_threshold}
    global_bottom = {k for k, c in bottom_counts.items() if c >= global_threshold}

    running_top = {k for k, c in top_counts.items() if running_threshold <= c < global_threshold}
    running_bottom = {k for k, c in bottom_counts.items() if running_threshold <= c < global_threshold}

    seen_running_top: Set[str] = set()
    seen_running_bottom: Set[str] = set()

    cleaned_pages: List[PageData] = []
    for page in page_list:
        lines = page.text.split("\n")
        non_empty_indices = [i for i, l in enumerate(lines) if l.strip()]

        if not non_empty_indices:
            cleaned_pages.append(PageData(page_number=page.page_number, text=""))
            continue

        top_indices = set(non_empty_indices[:window])
        bottom_indices = set(non_empty_indices[-window:])
        remove_indices: Set[int] = set()

        for idx in non_empty_indices[:window]:
            line_str = lines[idx].strip()
            key = _normalize_header_key(line_str)
            if _is_standalone_page_number(line_str):
                remove_indices.add(idx)
            elif key in global_top:
                remove_indices.add(idx)
            elif key in running_top:
                if key in seen_running_top:
                    remove_indices.add(idx)
                else:
                    seen_running_top.add(key)

        for idx in non_empty_indices[-window:]:
            line_str = lines[idx].strip()
            key = _normalize_header_key(line_str)
            if _is_standalone_page_number(line_str):
                remove_indices.add(idx)
            elif key in global_bottom:
                remove_indices.add(idx)
            elif key in running_bottom:
                if key in seen_running_bottom:
                    remove_indices.add(idx)
                else:
                    seen_running_bottom.add(key)

        kept_lines = [l for i, l in enumerate(lines) if i not in remove_indices]
        # Strip any remaining standalone page number at very first or very last non-empty line
        while kept_lines and not kept_lines[0].strip():
            kept_lines.pop(0)
        if kept_lines and _is_standalone_page_number(kept_lines[0]):
            kept_lines.pop(0)

        while kept_lines and not kept_lines[-1].strip():
            kept_lines.pop()
        if kept_lines and _is_standalone_page_number(kept_lines[-1]):
            kept_lines.pop()

        final_text = clean_page_text("\n".join(kept_lines))
        cleaned_pages.append(PageData(page_number=page.page_number, text=final_text))

    return cleaned_pages


def extract_pdf_pages(pdf_path: Union[str, Path], strip_headers: bool = True) -> List[PageData]:
    """
    Extract text page-by-page from a PDF file using PyMuPDF, preserving 1-based page numbers
    and optionally removing repeated headers and footers.
    """
    path = Path(pdf_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found at {path}")

    raw_pages: List[PageData] = []
    with pymupdf.open(path) as doc:
        for idx, page in enumerate(doc):
            raw_text = page.get_text("text")
            cleaned = clean_page_text(raw_text)
            raw_pages.append(PageData(page_number=idx + 1, text=cleaned))

    if strip_headers:
        return remove_repeated_headers_footers(raw_pages)
    return raw_pages
