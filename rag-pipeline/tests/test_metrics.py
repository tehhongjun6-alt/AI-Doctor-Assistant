from __future__ import annotations

import pytest

from medora_rag.evals.retrieval_eval import (
    ExpectedSpan,
    GoldenItem,
    RetrievedChunk,
    compute_hit_at_k,
    compute_reciprocal_rank,
    evaluate_mode,
    is_chunk_match,
    merge_multi_query_results,
)


def _make_chunk(
    doc_id: str,
    page_start: int,
    page_end: int,
    score: float,
    chunk_index: int = 0,
    chunk_id: int = 1,
) -> RetrievedChunk:
    return RetrievedChunk(
        chunk_id=chunk_id,
        doc_id=doc_id,
        title=f"CPG {doc_id}",
        edition_year=2024,
        source_url=f"https://example.com/{doc_id}.pdf",
        chunk_index=chunk_index,
        page_start=page_start,
        page_end=page_end,
        section="Test Section",
        content="Test content",
        score=score,
    )


def test_is_chunk_match_overlapping_pages() -> None:
    expected = [ExpectedSpan(doc_id="dengue", page_start=31, page_end=33)]
    # Exact match
    assert is_chunk_match("dengue", 31, 33, expected) is True
    # Overlapping boundary
    assert is_chunk_match("dengue", 29, 31, expected) is True
    assert is_chunk_match("dengue", 33, 35, expected) is True
    # Contained inside
    assert is_chunk_match("dengue", 32, 32, expected) is True
    # Wrong pages or wrong doc_id
    assert is_chunk_match("dengue", 10, 20, expected) is False
    assert is_chunk_match("t2dm", 31, 33, expected) is False


def test_hit_at_5_and_reciprocal_rank_fixed_examples() -> None:
    expected = [ExpectedSpan(doc_id="hypertension", page_start=85, page_end=89)]

    # Case 1: Correct chunk at rank 1 -> Hit@5 = True, RR = 1.0
    rank1_chunks = [
        _make_chunk("hypertension", 85, 86, score=0.032, chunk_index=1),
        _make_chunk("hypertension", 10, 12, score=0.028, chunk_index=2),
    ]
    assert compute_hit_at_k(rank1_chunks, expected, k=5) is True
    assert compute_reciprocal_rank(rank1_chunks, expected, k=5) == pytest.approx(1.0)

    # Case 2: Correct chunk at rank 3 -> Hit@5 = True, RR = 1/3
    rank3_chunks = [
        _make_chunk("hypertension", 10, 12, score=0.032, chunk_index=1),
        _make_chunk("dengue", 85, 86, score=0.030, chunk_index=2),
        _make_chunk("hypertension", 87, 89, score=0.025, chunk_index=3),
        _make_chunk("hypertension", 85, 86, score=0.020, chunk_index=4),
    ]
    assert compute_hit_at_k(rank3_chunks, expected, k=5) is True
    assert compute_reciprocal_rank(rank3_chunks, expected, k=5) == pytest.approx(1.0 / 3.0)

    # Case 3: Correct chunk at rank 6 (outside top 5) -> Hit@5 = False, RR = 0.0
    rank6_chunks = [
        _make_chunk("hypertension", i * 5, i * 5 + 2, score=0.03 - i * 0.001, chunk_index=i)
        for i in range(1, 6)
    ] + [_make_chunk("hypertension", 85, 86, score=0.01, chunk_index=6)]
    assert compute_hit_at_k(rank6_chunks, expected, k=5) is False
    assert compute_reciprocal_rank(rank6_chunks, expected, k=5) == pytest.approx(0.0)


def test_evaluate_mode_aggregates_hit_at_5_mrr_and_unanswerable_scores() -> None:
    items = [
        GoldenItem(
            id="q1",
            question_zh="问题1",
            queries_en=["q1_a"],
            expected=[ExpectedSpan(doc_id="dengue", page_start=6, page_end=7)],
            key_facts=["fact1"],
        ),
        GoldenItem(
            id="q2",
            question_zh="问题2",
            queries_en=["q2_a"],
            expected=[ExpectedSpan(doc_id="t2dm", page_start=27, page_end=28)],
            key_facts=["fact2"],
        ),
        GoldenItem(
            id="q3",
            question_zh="问题3",
            queries_en=["q3_a"],
            expected=[ExpectedSpan(doc_id="asthma", page_start=17, page_end=20)],
            key_facts=["fact3"],
        ),
        GoldenItem(
            id="u1",
            question_zh="无答案问题",
            queries_en=["u1_a"],
            expected=[],
            key_facts=[],
        ),
    ]

    mock_db: dict[str, list[RetrievedChunk]] = {
        # q1 hits at rank 1 (RR = 1.0)
        "q1_a": [_make_chunk("dengue", 6, 7, score=0.032, chunk_index=0)],
        # q2 hits at rank 2 (RR = 0.5)
        "q2_a": [
            _make_chunk("t2dm", 1, 2, score=0.030, chunk_index=0),
            _make_chunk("t2dm", 27, 28, score=0.028, chunk_index=5),
        ],
        # q3 misses (RR = 0.0)
        "q3_a": [_make_chunk("ckd", 10, 12, score=0.025, chunk_index=1)],
        # u1 unanswerable top score = 0.019
        "u1_a": [_make_chunk("dengue", 10, 12, score=0.019, chunk_index=2)],
    }

    summary = evaluate_mode("MockHybrid", items, lambda q: mock_db[q], top_k=5)
    assert summary.answerable_count == 3
    assert summary.unanswerable_count == 1
    # 2 out of 3 hit -> 2/3
    assert summary.hit_at_5 == pytest.approx(2.0 / 3.0)
    # MRR = (1.0 + 0.5 + 0.0) / 3 = 0.5
    assert summary.mrr == pytest.approx(0.5)
    assert summary.unanswerable_max_score == pytest.approx(0.019)


def test_merge_multi_query_results_deduplicates_and_keeps_highest_score() -> None:
    q1_results = [
        _make_chunk("dengue", 6, 7, score=0.025, chunk_index=0, chunk_id=1),
        _make_chunk("dengue", 31, 33, score=0.020, chunk_index=10, chunk_id=2),
    ]
    q2_results = [
        _make_chunk("dengue", 31, 33, score=0.032, chunk_index=10, chunk_id=2),
        _make_chunk("dengue", 53, 55, score=0.022, chunk_index=22, chunk_id=3),
    ]

    merged = merge_multi_query_results([q1_results, q2_results], top_k=5)
    assert len(merged) == 3
    assert (merged[0].doc_id, merged[0].chunk_index) == ("dengue", 10)
    assert merged[0].score == pytest.approx(0.032)
