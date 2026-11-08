import json
import math
import os
from pathlib import Path
import sys
import time
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

from dotenv import load_dotenv
from google import genai
import psycopg

EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIM = 768
DEFAULT_BATCH_SIZE = 25
MAX_GEMINI_BATCH_SIZE = 100


def normalize_vector(values: Sequence[float]) -> List[float]:
    """L2-normalize an embedding vector (recommended for MRL 768-d truncation)."""
    norm = math.sqrt(sum(v * v for v in values))
    if norm <= 0.0:
        return [float(v) for v in values]
    return [float(v) / norm for v in values]


def format_vector_literal(values: Sequence[float]) -> str:
    """Format a float vector as a pgvector literal string '[v1,v2,...]'."""
    return "[" + ",".join(f"{float(v):.8f}" for v in values) + "]"


def filter_chunks_needing_embedding(
    chunks: List[Dict[str, Any]],
    existing_state: Dict[Tuple[str, int], Tuple[str, bool]],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Partition chunks into (to_embed, skipped).
    A chunk is skipped if and only if (doc_id, chunk_index) already exists in the DB,
    its stored `content_hash` matches the chunk's `content_hash`, and `has_embedding` is True.
    """
    to_embed: List[Dict[str, Any]] = []
    skipped: List[Dict[str, Any]] = []

    for chunk in chunks:
        key = (str(chunk["doc_id"]), int(chunk["chunk_index"]))
        existing = existing_state.get(key)
        if existing is not None:
            stored_hash, has_embedding = existing
            if has_embedding and stored_hash == chunk["content_hash"]:
                skipped.append(chunk)
                continue
        to_embed.append(chunk)

    return to_embed, skipped


def _is_retryable_error(exc: Exception) -> bool:
    """Return True if the exception represents a rate-limit (429) or transient server error (503)."""
    msg = str(exc).lower()
    retry_tokens = ("429", "503", "resource_exhausted", "resourceexhausted", "unavailable", "rate limit", "quota", "too many requests")
    if any(tok in msg for tok in retry_tokens):
        return True
    status_code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    return status_code in (429, 503)


def embed_texts_with_retry(
    texts: List[str],
    embed_batch_fn: Callable[[List[str]], List[List[float]]],
    batch_size: int = DEFAULT_BATCH_SIZE,
    max_retries: int = 3,
    base_delay: float = 5.0,
    sleep_fn: Callable[[float], None] = time.sleep,
    on_batch_complete: Optional[Callable[[int, List[List[float]]], None]] = None,
) -> Tuple[List[List[float]], int]:
    """
    Embed a list of texts in batches of `batch_size` (1..100), retrying on 429/503 up to `max_retries` times.
    Returns (embeddings, api_call_count).
    """
    if not (1 <= batch_size <= MAX_GEMINI_BATCH_SIZE):
        raise ValueError(f"batch_size must be between 1 and {MAX_GEMINI_BATCH_SIZE}, got {batch_size}")

    if not texts:
        return [], 0

    import re as _re

    all_embeddings: List[List[float]] = []
    api_calls = 0
    total_batches = (len(texts) + batch_size - 1) // batch_size

    for batch_idx, start in enumerate(range(0, len(texts), batch_size), start=1):
        batch = texts[start : start + batch_size]
        attempt = 0
        while True:
            try:
                api_calls += 1
                batch_vectors = embed_batch_fn(batch)
                if len(batch_vectors) != len(batch):
                    raise RuntimeError(
                        f"Embedding batch size mismatch: sent {len(batch)} texts, got {len(batch_vectors)} vectors"
                    )
                all_embeddings.extend(batch_vectors)
                if on_batch_complete is not None:
                    on_batch_complete(start, batch_vectors)
                print(
                    f"  [Batch {batch_idx}/{total_batches}] Embedded {len(batch)} chunks "
                    f"({len(all_embeddings)}/{len(texts)})",
                    flush=True,
                )
                break
            except Exception as exc:
                if _is_retryable_error(exc) and attempt < max_retries:
                    attempt += 1
                    delay = base_delay * (2 ** (attempt - 1))
                    if sleep_fn is time.sleep:
                        m = _re.search(r"retry in (\d+(?:\.\d+)?)s", str(exc), _re.I)
                        if m:
                            delay = max(delay, float(m.group(1)) + 3.0)
                    print(
                        f"  [RETRY {attempt}/{max_retries}] Rate limit / transient error on batch {batch_idx}; "
                        f"waiting {delay:.1f}s...",
                        flush=True,
                    )
                    sleep_fn(delay)
                else:
                    raise

    return all_embeddings, api_calls


def create_gemini_embed_batch_fn(
    api_key: str,
    model: str = EMBEDDING_MODEL,
    output_dimensionality: int = EMBEDDING_DIM,
    task_type: str = "RETRIEVAL_DOCUMENT",
) -> Callable[[List[str]], List[List[float]]]:
    """Create a batch embedding callable using the official google-genai SDK."""
    client = genai.Client(
        api_key=api_key,
        http_options={"retry_options": {"attempts": 1}},
    )

    def _embed_batch(batch_texts: List[str]) -> List[List[float]]:
        response = client.models.embed_content(
            model=model,
            contents=batch_texts,
            config={
                "task_type": task_type,
                "output_dimensionality": output_dimensionality,
            },
        )
        if not response.embeddings:
            raise RuntimeError("Empty embeddings returned from Gemini API")
        vectors: List[List[float]] = []
        for emb in response.embeddings:
            vec = normalize_vector(emb.values)
            if len(vec) != output_dimensionality:
                raise ValueError(f"Expected {output_dimensionality}-d vector, got {len(vec)}")
            vectors.append(vec)
        return vectors

    return _embed_batch


def load_manifest_and_chunks(
    manifest_path: Optional[Path] = None,
    chunks_dir: Optional[Path] = None,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Load manifest.json and all corresponding data/chunks/<doc_id>.jsonl files."""
    base_dir = Path(__file__).resolve().parent.parent
    if manifest_path is None:
        manifest_path = base_dir / "data" / "manifest.json"
    if chunks_dir is None:
        chunks_dir = base_dir / "data" / "chunks"

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest: List[Dict[str, Any]] = json.load(f)

    all_chunks: List[Dict[str, Any]] = []
    for doc in manifest:
        doc_id = doc["doc_id"]
        jsonl_path = chunks_dir / f"{doc_id}.jsonl"
        if not jsonl_path.exists():
            raise FileNotFoundError(f"Chunks file not found for {doc_id}: {jsonl_path}")
        with open(jsonl_path, "r", encoding="utf-8") as cf:
            for line in cf:
                line = line.strip()
                if line:
                    all_chunks.append(json.loads(line))

    return manifest, all_chunks


def ingest_to_database(
    manifest: List[Dict[str, Any]],
    chunks: List[Dict[str, Any]],
    conn: Any,
    embed_batch_fn: Callable[[List[str]], List[List[float]]],
    batch_size: int = DEFAULT_BATCH_SIZE,
    embedding_model: str = EMBEDDING_MODEL,
    max_retries: int = 3,
    base_delay: float = 5.0,
    sleep_fn: Callable[[float], None] = time.sleep,
) -> Dict[str, int]:
    """
    Upsert cpg_documents and cpg_chunks into PostgreSQL.
    Only computes embeddings for new chunks or chunks whose content_hash has changed.
    """
    with conn.cursor() as cur:
        # 1. Upsert cpg_documents
        for doc in manifest:
            cur.execute(
                """
                insert into public.cpg_documents (doc_id, title, edition_year, source_url, ingested_at)
                values (%s, %s, %s, %s, now())
                on conflict (doc_id) do update set
                  title = excluded.title,
                  edition_year = excluded.edition_year,
                  source_url = excluded.source_url,
                  ingested_at = now();
                """,
                (doc["doc_id"], doc["title"], int(doc["edition_year"]), doc["source_url"]),
            )

        # 2. Fetch existing chunk hashes and embedding presence
        cur.execute(
            """
            select doc_id, chunk_index, content_hash, (embedding is not null) as has_embedding
            from public.cpg_chunks;
            """
        )
        rows = cur.fetchall()
        existing_state: Dict[Tuple[str, int], Tuple[str, bool]] = {
            (str(r[0]), int(r[1])): (str(r[2]), bool(r[3])) for r in rows
        }

    conn.commit()

    # 3. Filter chunks that actually need embedding
    to_embed, skipped = filter_chunks_needing_embedding(chunks, existing_state)

    def _save_batch(start_idx: int, batch_vecs: List[List[float]]) -> None:
        batch_chunks = to_embed[start_idx : start_idx + len(batch_vecs)]
        with conn.cursor() as cur:
            for chunk, vec in zip(batch_chunks, batch_vecs):
                vec_literal = format_vector_literal(vec)
                cur.execute(
                    """
                    insert into public.cpg_chunks (
                      doc_id, chunk_index, page_start, page_end, section, content,
                      content_hash, embedding, embedding_model
                    )
                    values (%s, %s, %s, %s, %s, %s, %s, %s::vector, %s)
                    on conflict (doc_id, chunk_index) do update set
                      page_start = excluded.page_start,
                      page_end = excluded.page_end,
                      section = excluded.section,
                      content = excluded.content,
                      content_hash = excluded.content_hash,
                      embedding = excluded.embedding,
                      embedding_model = excluded.embedding_model;
                    """,
                    (
                        chunk["doc_id"],
                        int(chunk["chunk_index"]),
                        int(chunk["page_start"]),
                        int(chunk["page_end"]),
                        chunk["section"],
                        chunk["content"],
                        chunk["content_hash"],
                        vec_literal,
                        embedding_model,
                    ),
                )
        conn.commit()

    texts_to_embed = [f"{c['section']}\n\n{c['content']}" for c in to_embed]
    _, api_calls = embed_texts_with_retry(
        texts_to_embed,
        embed_batch_fn=embed_batch_fn,
        batch_size=batch_size,
        max_retries=max_retries,
        base_delay=base_delay,
        sleep_fn=sleep_fn,
        on_batch_complete=_save_batch,
    )

    summary = {
        "total_chunks": len(chunks),
        "embedded_chunks": len(to_embed),
        "skipped_chunks": len(skipped),
        "api_calls": api_calls,
    }
    print(
        f"Ingestion complete: total={summary['total_chunks']} | "
        f"newly_embedded={summary['embedded_chunks']} | "
        f"skipped={summary['skipped_chunks']} | "
        f"embedding_api_calls={summary['api_calls']}",
        flush=True,
    )
    return summary


def load_env_config() -> Tuple[str, str]:
    """Load GEMINI_API_KEY and DATABASE_URL from rag-pipeline/.env or ../consultation-backend/.env."""
    base_dir = Path(__file__).resolve().parent.parent
    local_env = base_dir / ".env"
    backend_env = base_dir.parent / "consultation-backend" / ".env"

    if local_env.exists():
        load_dotenv(local_env, override=False)
    if backend_env.exists():
        load_dotenv(backend_env, override=False)

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    db_url = os.environ.get("DATABASE_URL", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set in environment or .env")
    if not db_url:
        raise RuntimeError("DATABASE_URL is not set in environment or .env")
    return api_key, db_url


def main() -> Dict[str, int]:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    api_key, db_url = load_env_config()
    manifest, chunks = load_manifest_and_chunks()
    embed_fn = create_gemini_embed_batch_fn(api_key=api_key)

    with psycopg.connect(db_url) as conn:
        return ingest_to_database(
            manifest=manifest,
            chunks=chunks,
            conn=conn,
            embed_batch_fn=embed_fn,
            batch_size=DEFAULT_BATCH_SIZE,
            base_delay=22.0,
        )


if __name__ == "__main__":
    main()
