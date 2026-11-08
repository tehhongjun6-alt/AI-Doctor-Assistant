# MOH CPG Retrieval Evaluation Report (2026-11-08)

## 1. Evaluation Setup
- **Date**: 2026-11-08
- **Embedding Model**: `gemini-embedding-001` (768 dimensions, L2-normalized, `RETRIEVAL_QUERY`)
- **Corpus**: 6 Malaysian MOH Clinical Practice Guidelines (499 chunks in Supabase `pgvector`)
- **Golden Dataset**: 40 questions (`evals/golden.jsonl`: 32 answerable across 6 guidelines + 8 out-of-corpus unanswerable)
- **Query Embedding API Calls This Run**: 0 (cached in `evals/cache/query_embeddings.json`)

## 2. Overall Metrics Comparison (32 Answerable + 8 Unanswerable)

| Retrieval Mode | Answerable Hit@5 | Answerable MRR@5 | Answerable Mean Top-1 Score | Answerable Min Top-1 Score | Unanswerable Max Score | Unanswerable Mean Top-1 Score |
|---|---:|---:|---:|---:|---:|---:|
| **Vector-Only (Cosine)** | **0.9688** (31/32) | **0.8490** | 0.763958 | 0.724618 | 0.648822 | 0.613321 |
| **Keyword-Only (FTS)** | **0.8438** (27/32) | **0.7135** | 0.026936 | 0.000000 | 0.000610 | 0.000076 |
| **Hybrid (RRF)** | **0.9688** (31/32) | **0.9167** | 0.032656 | 0.032002 | 0.032522 | 0.031242 |

## 3. Per-Guideline Breakdown (Hybrid RRF)

| Guideline (`doc_id`) | Questions | Hit@5 | MRR@5 |
|---|---:|---:|---:|
| `dengue` | 6 | 6/6 (100.00%) | 0.9167 |
| `t2dm` | 6 | 6/6 (100.00%) | 1.0000 |
| `hypertension` | 5 | 5/5 (100.00%) | 1.0000 |
| `asthma` | 5 | 5/5 (100.00%) | 0.8667 |
| `ckd` | 5 | 5/5 (100.00%) | 0.9000 |
| `dyslipidaemia` | 5 | 4/5 (80.00%) | 0.8000 |

## 4. Missed Questions & Error Analysis

### Vector-Only (Cosine) — Missed Answerable Questions (1)
- **`dyslipidaemia-02`**: 已经有冠心病或中风病史的极高危患者，坏胆固醇（LDL-C）的目标值要降到多少以下？
  - Queries: `['very high cardiovascular risk LDL-C target 1.4', 'secondary prevention statin LDL cholesterol goal']`
  - Expected: `dyslipidaemia p.20-22, dyslipidaemia p.72-74` | Top Retrieved: `dyslipidaemia p.68-69 (0.7489), dyslipidaemia p.46-47 (0.7426), dyslipidaemia p.61-61 (0.7409)`

### Keyword-Only (FTS) — Missed Answerable Questions (5)
- **`dengue-01`**: 骨痛热症（登革热）进入危险期时有哪些危险信号（warning signs）需要马上就医？
  - Queries: `['dengue warning signs', 'dengue critical phase']`
  - Expected: `dengue p.31-33, dengue p.43-45` | Top Retrieved: `dengue p.37-38 (0.2083), dengue p.64-66 (0.1663), dengue p.62-64 (0.1299)`
- **`t2dm-04`**: 糖尿病患者发生低血糖（血糖低于 3.9 mmol/L）但人还清醒时，应该吃多少克糖或喝多少果汁来急救？
  - Queries: `['hypoglycaemia treatment 15g carbohydrate', 'diabetes low blood glucose management']`
  - Expected: `t2dm p.118-122` | Top Retrieved: `t2dm p.132-134 (0.0024), t2dm p.137-138 (0.0009), t2dm p.153-155 (0.0006)`
- **`t2dm-05`**: 糖尿病伴慢性肾病（DKD）患者的血压目标是多少？什么情况下应该停用 SGLT2 抑制剂或转诊肾脏科？
  - Queries: `['diabetic kidney disease blood pressure target', 'DKD SGLT2 inhibitor nephrologist referral']`
  - Expected: `t2dm p.146-149` | Top Retrieved: `ckd p.7-8 (0.0095), t2dm p.43-45 (0.0068), ckd p.29-31 (0.0033)`
- **`ckd-02`**: 慢性肾病患者开始吃 ACEi 或 ARB 降压护肾药后，多久要复查抽血？肌酐或血钾升到多少必须减量或停药？
  - Queries: `['CKD ACEi ARB monitoring creatinine potassium', 'renoprotection proteinuria ACE inhibitor discontinuation']`
  - Expected: `ckd p.32-34` | Top Retrieved: `No chunks returned`
- **`dyslipidaemia-02`**: 已经有冠心病或中风病史的极高危患者，坏胆固醇（LDL-C）的目标值要降到多少以下？
  - Queries: `['very high cardiovascular risk LDL-C target 1.4', 'secondary prevention statin LDL cholesterol goal']`
  - Expected: `dyslipidaemia p.20-22, dyslipidaemia p.72-74` | Top Retrieved: `t2dm p.43-45 (0.0021), t2dm p.101-103 (0.0014), dyslipidaemia p.66-67 (0.0004)`

### Hybrid (RRF) — Missed Answerable Questions (1)
- **`dyslipidaemia-02`**: 已经有冠心病或中风病史的极高危患者，坏胆固醇（LDL-C）的目标值要降到多少以下？
  - Queries: `['very high cardiovascular risk LDL-C target 1.4', 'secondary prevention statin LDL cholesterol goal']`
  - Expected: `dyslipidaemia p.20-22, dyslipidaemia p.72-74` | Top Retrieved: `dyslipidaemia p.61-61 (0.0320), dyslipidaemia p.55-56 (0.0315), dyslipidaemia p.66-67 (0.0311)`

## 5. Unanswerable (Out-of-Corpus) Score Distribution (Hybrid RRF)

| Question ID | Question | Queries | Top-1 Retrieved (`doc_id` pages) | Top-1 RRF Score |
|---|---|---|---|---:|
| `unanswerable-01` | 经常偏头痛发作、怕光怕吵，应该吃什么特效止痛药或预防性药物？ | `migraine headache treatment triptans, migraine prophylaxis` | `hypertension` p.85-86 | 0.031319 |
| `unanswerable-02` | 皮肤反反复复长湿疹（特应性皮炎）、非常痒，擦类固醇药膏要注意什么？ | `atopic dermatitis eczema topical corticosteroids, eczema skin flare management` | `asthma` p.64-66 | 0.032522 |
| `unanswerable-03` | 胃食管反流（GERD）经常反酸烧心，质子泵抑制剂（PPI）要吃多久一个疗程？ | `gastroesophageal reflux disease GERD PPI duration, heartburn acid reflux treatment` | `dyslipidaemia` p.65-65 | 0.032018 |
| `unanswerable-04` | 急性痛风发作脚趾红肿剧痛，秋水仙碱（colchicine）怎么吃？什么时候开始吃别嘌醇降尿酸？ | `acute gout flare colchicine dosing, gout urate lowering therapy allopurinol` | `dyslipidaemia` p.55-56 | 0.030159 |
| `unanswerable-05` | 怀疑感染肺结核（TB）咳嗽超过两周，标准六个月抗结核药物（2HRZE/4HR）方案是怎么吃的？ | `pulmonary tuberculosis treatment regimen 2HRZE, TB diagnosis sputum AFB` | `asthma` p.29-30 | 0.030886 |
| `unanswerable-06` | 女性得急性膀胱炎（尿道炎）尿频尿痛，一线抗生素应该吃呋喃妥因还是磷霉素？ | `acute uncomplicated urinary tract infection cystitis antibiotics, UTI nitrofurantoin fosfomycin` | `ckd` p.60-62 | 0.031319 |
| `unanswerable-07` | 老年人骨质疏松症（osteoporosis）骨密度 T 值低于 -2.5，双膦酸盐（如阿仑膦酸钠）要吃几年？ | `osteoporosis BMD T-score bisphosphonates alendronate, fragility fracture prevention` | `t2dm` p.280-281 | 0.029958 |
| `unanswerable-08` | 成年人重度抑郁症（MDD）第一次发作，选择性血清素再摄取抑制剂（SSRI）抗抑郁药要吃多久才见效？ | `major depressive disorder SSRI antidepressant duration, depression first line pharmacotherapy` | `t2dm` p.173-175 | 0.031754 |

## 6. Parameter Decisions for Step 5 Backend Integration
- **`match_count` per query**: **`3`**
  - *Rationale*: In Hybrid RRF, MRR@5 is **0.9167** (29 of 31 hit questions rank the correct clinical chunk at #1 or #2, and 31/32 within top 3). Fetching `match_count = 3` per English search query captures virtually all relevant clinical guideline pages while keeping prompt token overhead low and respecting `MAX_PER_PROVIDER = 4` in `medicalDataService.ts`.
- **Minimum RRF Score Threshold**: **No hard RRF score cutoff (`none`)**
  - *Rationale*: Because `match_cpg_chunks` computes Reciprocal Rank Fusion (`1 / (60 + rank)`) over relative ranks (1..20) rather than raw cosine similarity, any chunk ranked #1 by vector search receives at least `1 / 61 ≈ 0.01639` (and up to `2 / 61 ≈ 0.03279` if it also matches a generic keyword like `treatment` or `management` in full-text search). Consequently, the RRF score range for unanswerable questions (`0.029958 – 0.032522`) overlaps with answerable questions (`0.032002 – 0.032787`), so a hard RRF score threshold would either fail to filter out-of-corpus queries or falsely drop valid clinical hits.
  - *How out-of-corpus questions are handled*: In Medora's architecture, `cpg` is queried alongside the existing 6 authoritative external APIs (MedlinePlus, openFDA, RxNorm, KKMNow, NHS, ICD-11), and the consultation LLM only cites sources whose content directly addresses the user's condition (verified in Step 6 & Step 7 end-to-end checks).
