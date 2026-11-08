from __future__ import annotations

from pathlib import Path
import pytest

from medora_rag.evals.answer_eval import (
    BackendAnswerRecord,
    JudgeEvaluation,
    SELECTED_QUESTION_IDS,
    SourceItem,
    detect_moh_cpg_citation,
    format_structured_answer,
    generate_answer_eval_report,
    judge_condition_records,
    select_eval_questions,
)
from medora_rag.evals.retrieval_eval import ExpectedSpan, GoldenItem, load_golden_items


def test_selected_question_ids_cover_all_6_guidelines_with_15_questions() -> None:
    items = load_golden_items()
    selected = select_eval_questions(items, SELECTED_QUESTION_IDS)
    assert len(selected) == 15

    counts_by_doc: dict[str, int] = {}
    for item in selected:
        assert item.expected, f"Selected question {item.id} must be answerable"
        doc_id = item.expected[0].doc_id
        counts_by_doc[doc_id] = counts_by_doc.get(doc_id, 0) + 1

    assert set(counts_by_doc.keys()) == {
        "dengue",
        "t2dm",
        "hypertension",
        "asthma",
        "ckd",
        "dyslipidaemia",
    }
    for doc_id, count in counts_by_doc.items():
        assert 2 <= count <= 3, f"Guideline {doc_id} has {count} questions, expected 2..3"


def test_format_structured_answer_and_cpg_citation_detection() -> None:
    answer_obj = {
        "summary": "骨痛热症在退烧期容易出现危险信号。",
        "possibleCauses": [],
        "advice": ["✅ **危险信号** — 剧烈腹痛、持续呕吐、黏膜出血。"],
        "seekCareWhen": ["🔴 **立即就医** — 4至6小时无尿。"],
        "followUpQuestions": [],
    }
    text = format_structured_answer(answer_obj)
    assert "【摘要】" in text
    assert "剧烈腹痛" in text
    assert "【何时就医】" in text

    sources_without_cpg = [
        SourceItem(title="Dengue", url="https://medlineplus.gov/dengue.html", provider="medlineplus")
    ]
    assert detect_moh_cpg_citation(sources_without_cpg, text) is False

    sources_with_cpg = [
        SourceItem(
            title="MOH CPG: MANAGEMENT OF DENGUE IN ADULTS (FOURTH EDITION)（p. 31-33）",
            url="https://mymahtas2.moh.gov.my/files/CPG.pdf#page=31",
            provider="cpg",
        )
    ]
    assert detect_moh_cpg_citation(sources_with_cpg, text) is True


def test_judge_condition_records_aggregates_and_generates_report() -> None:
    q1 = GoldenItem(
        id="dengue-01",
        question_zh="骨痛热症有什么危险信号？",
        queries_en=["dengue warning signs"],
        expected=[ExpectedSpan(doc_id="dengue", page_start=31, page_end=33)],
        key_facts=["退烧期出现", "剧烈腹痛与持续呕吐", "HCT升高伴血小板下降"],
    )
    records_a = {
        "dengue-01": BackendAnswerRecord(
            question_id="dengue-01",
            mode="A",
            route="medical_qa",
            category="disease",
            search_queries=["dengue"],
            answer={"summary": "注意腹痛和呕吐。"},
            formatted_answer_text="【摘要】\n注意腹痛和呕吐。",
            sources=[SourceItem(title="MedlinePlus Dengue", url="https://example.com", provider="medlineplus")],
            cites_moh_cpg=False,
        )
    }
    records_b = {
        "dengue-01": BackendAnswerRecord(
            question_id="dengue-01",
            mode="B",
            route="medical_qa",
            category="disease",
            search_queries=["dengue"],
            answer={"summary": "退烧第3-7天注意腹痛、呕吐及HCT升高伴血小板快速下降。"},
            formatted_answer_text="【摘要】\n退烧第3-7天注意腹痛、呕吐及HCT升高伴血小板快速下降。",
            sources=[
                SourceItem(
                    title="MOH CPG: Dengue（p. 31-33）",
                    url="https://example.com/dengue.pdf#page=31",
                    provider="cpg",
                )
            ],
            cites_moh_cpg=True,
        )
    }

    cache: dict = {}
    cache_path = Path(__file__).resolve().parent.parent / "evals" / "cache" / "_test_answer_eval_tmp.json"
    try:
        agg_a, calls_a = judge_condition_records(
            mode="A",
            label="Condition A",
            questions=[q1],
            records=records_a,
            cache=cache,
            cache_path=cache_path,
            api_key="dummy",
            judge_fn=lambda item, rec: JudgeEvaluation(
                covered_count=1,
                total_facts=3,
                coverage_ratio=1.0 / 3.0,
                fact_verdicts=[False, True, False],
                faithfulness_score=1.0,
                unsupported_claims=[],
                reasoning="仅覆盖腹痛呕吐。",
            ),
        )
        agg_b, calls_b = judge_condition_records(
            mode="B",
            label="Condition B",
            questions=[q1],
            records=records_b,
            cache=cache,
            cache_path=cache_path,
            api_key="dummy",
            judge_fn=lambda item, rec: JudgeEvaluation(
                covered_count=3,
                total_facts=3,
                coverage_ratio=1.0,
                fact_verdicts=[True, True, True],
                faithfulness_score=1.0,
                unsupported_claims=[],
                reasoning="完整覆盖全部3条要点。",
            ),
        )
    finally:
        if cache_path.exists():
            cache_path.unlink()

    assert calls_a == 1
    assert calls_b == 1
    assert agg_a.mean_coverage_ratio == pytest.approx(1.0 / 3.0)
    assert agg_b.mean_coverage_ratio == pytest.approx(1.0)
    assert agg_a.cpg_citation_rate == pytest.approx(0.0)
    assert agg_b.cpg_citation_rate == pytest.approx(1.0)

    report = generate_answer_eval_report(
        agg_a=agg_a,
        agg_b=agg_b,
        eval_date="2026-11-08",
        chat_model="gemini-3.5-flash-lite",
        judge_model="gemini-3.5-flash-lite",
        example_ids=("dengue-01", "dengue-01", "dengue-01"),
    )
    assert "Condition A (`CPG_RAG_ENABLED=false`)" in report
    assert "Condition B (`CPG_RAG_ENABLED=true`)" in report
    assert "dengue-01" in report
