from typing import Any, Dict, List, Tuple
import pytest

from medora_rag.ingest import (
    EMBEDDING_DIM,
    embed_texts_with_retry,
    filter_chunks_needing_embedding,
    ingest_to_database,
)


class FakeCursor:
    def __init__(self, db: "FakeDB") -> None:
        self.db = db
        self._last_rows: List[Tuple[Any, ...]] = []

    def __enter__(self) -> "FakeCursor":
        return self

    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        pass

    def execute(self, sql: str, params: Tuple[Any, ...] = ()) -> None:
        norm = " ".join(sql.lower().split())
        if norm.startswith("insert into public.cpg_documents"):
            doc_id, title, year, url = params
            self.db.documents[doc_id] = {
                "doc_id": doc_id,
                "title": title,
                "edition_year": year,
                "source_url": url,
            }
        elif norm.startswith("select doc_id, chunk_index, content_hash"):
            self._last_rows = [
                (
                    row["doc_id"],
                    row["chunk_index"],
                    row["content_hash"],
                    row.get("embedding") is not None,
                )
                for row in self.db.chunks.values()
            ]
        elif norm.startswith("insert into public.cpg_chunks"):
            (
                doc_id,
                chunk_index,
                page_start,
                page_end,
                section,
                content,
                content_hash,
                vec_literal,
                embedding_model,
            ) = params
            self.db.chunks[(doc_id, chunk_index)] = {
                "doc_id": doc_id,
                "chunk_index": chunk_index,
                "page_start": page_start,
                "page_end": page_end,
                "section": section,
                "content": content,
                "content_hash": content_hash,
                "embedding": vec_literal,
                "embedding_model": embedding_model,
            }

    def fetchall(self) -> List[Tuple[Any, ...]]:
        return list(self._last_rows)


class FakeDB:
    def __init__(self) -> None:
        self.documents: Dict[str, Dict[str, Any]] = {}
        self.chunks: Dict[Tuple[str, int], Dict[str, Any]] = {}
        self.committed = 0

    def cursor(self) -> FakeCursor:
        return FakeCursor(self)

    def commit(self) -> None:
        self.committed += 1


def _make_sample_chunks(count: int, doc_id: str = "dengue") -> List[Dict[str, Any]]:
    return [
        {
            "doc_id": doc_id,
            "chunk_index": i,
            "page_start": i + 1,
            "page_end": i + 2,
            "section": f"Section {i}",
            "content": f"Sample clinical content for chunk {i}",
            "content_hash": f"{i:064x}",
        }
        for i in range(count)
    ]


def test_unchanged_chunks_not_re_embedded():
    """Unchanged chunks (matching content_hash and existing embedding) must not re-run embedding."""
    db = FakeDB()
    manifest = [
        {
            "doc_id": "dengue",
            "title": "MANAGEMENT OF DENGUE IN ADULTS",
            "edition_year": 2026,
            "source_url": "https://mymahtas2.moh.gov.my/files/dengue.pdf",
            "sha256": "a" * 64,
        }
    ]
    chunks = _make_sample_chunks(5)

    recorded_batches: List[List[str]] = []

    def fake_embed_batch(batch_texts: List[str]) -> List[List[float]]:
        recorded_batches.append(list(batch_texts))
        return [[0.01] * EMBEDDING_DIM for _ in batch_texts]

    # Run 1: All 5 chunks are new -> 5 embedded, 0 skipped, 1 API call
    res1 = ingest_to_database(
        manifest=manifest,
        chunks=chunks,
        conn=db,
        embed_batch_fn=fake_embed_batch,
        batch_size=50,
    )
    assert res1 == {
        "total_chunks": 5,
        "embedded_chunks": 5,
        "skipped_chunks": 0,
        "api_calls": 1,
    }
    assert len(recorded_batches) == 1
    assert len(recorded_batches[0]) == 5

    # Run 2: No content changed -> 0 embedded, 5 skipped, 0 API calls
    recorded_batches.clear()
    res2 = ingest_to_database(
        manifest=manifest,
        chunks=chunks,
        conn=db,
        embed_batch_fn=fake_embed_batch,
        batch_size=50,
    )
    assert res2 == {
        "total_chunks": 5,
        "embedded_chunks": 0,
        "skipped_chunks": 5,
        "api_calls": 0,
    }
    assert len(recorded_batches) == 0

    # Run 3: Modify chunk #2's content_hash -> only 1 chunk embedded, 4 skipped, 1 API call
    chunks_modified = _make_sample_chunks(5)
    chunks_modified[2]["content"] = "Updated clinical content for chunk 2"
    chunks_modified[2]["content_hash"] = "f" * 64

    res3 = ingest_to_database(
        manifest=manifest,
        chunks=chunks_modified,
        conn=db,
        embed_batch_fn=fake_embed_batch,
        batch_size=50,
    )
    assert res3 == {
        "total_chunks": 5,
        "embedded_chunks": 1,
        "skipped_chunks": 4,
        "api_calls": 1,
    }
    assert len(recorded_batches) == 1
    assert len(recorded_batches[0]) == 1
    assert "Updated clinical content for chunk 2" in recorded_batches[0][0]


def test_batch_size_splitting_and_validation():
    """Chunks are split into exact batch sizes and batch_size > 100 is rejected."""
    batch_sizes_seen: List[int] = []

    def fake_embed_batch(batch_texts: List[str]) -> List[List[float]]:
        batch_sizes_seen.append(len(batch_texts))
        return [[0.5] * EMBEDDING_DIM for _ in batch_texts]

    texts = [f"text {i}" for i in range(120)]
    vectors, calls = embed_texts_with_retry(texts, embed_batch_fn=fake_embed_batch, batch_size=50)

    assert calls == 3
    assert batch_sizes_seen == [50, 50, 20]
    assert len(vectors) == 120

    with pytest.raises(ValueError, match="batch_size"):
        embed_texts_with_retry(texts, embed_batch_fn=fake_embed_batch, batch_size=101)


def test_retry_on_429_and_503():
    """Transient 429 and 503 errors are retried with backoff up to max_retries."""
    attempts = 0
    slept_delays: List[float] = []

    def flaky_embed_batch(batch_texts: List[str]) -> List[List[float]]:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise RuntimeError("429 ResourceExhausted: Quota exceeded")
        if attempts == 2:
            raise RuntimeError("503 Service Unavailable")
        return [[0.25] * EMBEDDING_DIM for _ in batch_texts]

    vectors, api_calls = embed_texts_with_retry(
        ["doc 1", "doc 2"],
        embed_batch_fn=flaky_embed_batch,
        batch_size=10,
        max_retries=3,
        base_delay=2.0,
        sleep_fn=slept_delays.append,
    )

    assert len(vectors) == 2
    assert attempts == 3
    assert api_calls == 3
    assert slept_delays == [2.0, 4.0]
