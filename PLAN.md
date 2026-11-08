# PLAN.md — Medora 向量 RAG：马来西亚卫生部临床指南（第一版）

> 规划日期：2026-11-08｜状态：规划已确认，尚未开始执行
> 之前的计划都已完成，存档在 `plans/` 文件夹
> 给用户看的白话说明在 `PLAN-explained.md`（只是说明，不记录进度）；如果改了设计，也要同步改它
>
> **执行者须知**：每一步都写明了「改哪些文件、怎么做、完成标准」。**设计已经定好，照着做，不要自行改设计。** 如果发现计划和代码对不上，停下来汇报，不要自己发挥。**第 7 步之前不要推送**（推送会触发线上部署）。

## 1. 项目是什么

- **产品**：Medora，给马来西亚用户用的 AI 健康咨询网页（[heymedora.vercel.app](https://heymedora.vercel.app/)）
- **这次的目标**：**保留**现在的「外部医学 API 检索」，**再加一个来源**：用马来西亚卫生部的临床实践指南（MOH CPG）做成的**向量数据库**。用户提问时，两种来源一起查，回答可以引用「哪份指南、第几页」
- **为什么做（作品集）**：补上招聘广告最常要求、Medora 还没有的能力：**embeddings、向量数据库、混合检索、RAG 评估（evals）、Python**
- **项目阶段**：**C（已经做完，要升级）**｜**规模**：中型（新增 Python 资料管线 + 后端一个新来源 + 评估）
- **现有架构（这次会碰到的部分）**
  - 后端：TypeScript + Express，`consultation-backend/src/`；数据库用 `pg` 连 Supabase Postgres（Session pooler），迁移文件在 `consultation-backend/sql/`（目前有 `001`、`002`）
  - 分流：`routing/medicalDataRouter.ts` 会把用户问题转成 1～4 个**英文**查询词（`searchQueries`）
  - 检索：`services/medicalData/medicalDataService.ts`
    - `providerSearches` 登记每个来源，`providersFor()` 按问题类型选来源
    - `mergeEvidence()` 每个来源最多 4 条、总共最多 10 条
  - 来源类型：`services/medicalData/medicalDataTypes.ts` 的 `MedicalDataProvider`、`MedicalEvidence`
  - 拼进 prompt：`services/geminiHealthConsultation.ts` 约第 292 行，格式是「标题 / 来源 / 链接 / 内容」
  - 前端来源标签：`consultation-frontend/src/chat/AssistantMessage.tsx` 的 `PROVIDER_LABELS`
  - 已有的人工测试题：根目录 `eval/answer-accuracy-test.md`（22 题端到端，**这次不改它**）
- **测试命令**
  - 后端：`cd consultation-backend && npm test`，编译检查 `npm run build`
  - 前端：`cd consultation-frontend && npm test`，编译检查 `npm run build`
  - Python（新）：`cd rag-pipeline && python -m pytest`

## 2. 已定决策

| 决策 | 选择 | 为什么 |
|---|---|---|
| 和现有 API 检索的关系 | **保留**，向量库作为第 7 个来源 `cpg` 接进去 | 不推翻已经能用的东西；面试可以讲「API + 本地向量库的混合检索架构」 |
| 资料 | 马来西亚卫生部临床实践指南（MOH CPG）的 PDF，**第一版只用 6 份** | 本地化、权威、量够（几百页）；先少量跑通再加 |
| 资料处理和评估用什么写 | **Python**，放在新文件夹 `rag-pipeline/` | 用户选的；招聘几乎都要 Python |
| 问答时的检索用什么写 | **TypeScript**，在现有后端里 | 后端本来就是 TS，不另开服务 |
| 向量数据库 | **Supabase Postgres + pgvector**（用现有的数据库） | 不加新服务、不加费用 |
| Embedding 模型 | **Gemini embedding**（实际模型名第 3 步查证），输出 **768 维** | 已经在用 Gemini；768 维够用，而且 pgvector 的 HNSW 索引最多支持 2000 维 |
| 检索方式 | **混合检索**：向量相似度 + Postgres 全文搜索（关键词），用 RRF 合并排名 | 医疗名词（药名、病名）关键词搜索很准，语义搜索补意思相近的问题 |
| 用哪种语言查 | 用分流器已经产生的**英文查询词**去查（指南是英文） | 不用多做翻译 |
| 评估资料 | **从这 6 份指南出题**（AI 起草，用户审核），**不用 MedQuAD** | MedQuAD 是美国的资料，答案不在 MOH 指南里，拿来测这个向量库没有意义（之前的建议在此更正） |
| 上线开关 | 环境变量 `CPG_RAG_ENABLED`，默认关闭 | 线上可以随时关掉，不影响现有功能 |
| PDF 原文件 | **不放进 Git**，只记录下载网址和校验码 | 版权属于卫生部；仓库是公开的 |

### 第一版的 6 份指南（执行者第 1 步查证后填入实际名称和版本）

选和健康指南卡片重叠、马来西亚常见的病：

| # | doc_id | 主题 | 对应健康指南卡片 |
|---|---|---|---|
| 1 | `dengue` | Management of Dengue Infection in Adults | 骨痛热症 |
| 2 | `t2dm` | Management of Type 2 Diabetes Mellitus | 糖尿病 |
| 3 | `hypertension` | Management of Hypertension | 高血压 |
| 4 | `asthma` | Management of Asthma in Adults | 哮喘 |
| 5 | `ckd` | Management of Chronic Kidney Disease | 慢性肾病 |
| 6 | `dyslipidaemia` | Management of Dyslipidaemia | 高胆固醇 |

找不到某一份，就挑最接近的常见病代替，并在实际做法里写明。

## 3. 护栏与不可改动的部分

### 护栏（必须做到）

- **资料只能来自 MOH 官方网站**（moh.gov.my 或 Academy of Medicine Malaysia acadmed.org.my），下载网址必须是执行者**实际打开过**的，不准编造
- **PDF 不进 Git**：`rag-pipeline/data/raw/` 加进 `.gitignore`；清单文件只记录网址、版本年份、SHA-256
- **API key 不进 Git**：`rag-pipeline/.env` 加进 `.gitignore`，另外提供 `rag-pipeline/.env.example`（只有变量名）
- 每个切块都要记录 **doc_id、页码、章节标题**；回答引用时要能对应到「哪份指南、第几页」
- 来源链接用 `PDF 网址#page=N`，用户点了会直接打开那一页
- **向量库出错不能拖垮问诊**：数据库或 embedding 失败时，`cpg` 来源回报错误，其他 API 来源照常工作（跟现有来源的错误处理一样）
- **省 Gemini 额度**：
  - 入库时**批量** embedding，已经入库、内容没变的切块不再重算（用内容的 hash 判断）
  - 评估时把查询向量**缓存到文件**，重跑不再收费
  - 每一步写明预计调用次数
- **评估数字必须是真的跑出来的**，报告里写明日期、模型、题数；不准估计或编造
- 新增的 SQL 只能**新增**表和函数，不改现有的 `conversations` 等表

### 不可改动（除非用户明确同意）

- 现有 6 个 API 来源的行为（MedlinePlus、openFDA、RxNorm、KKMNow、NHS、ICD-11）
- 分流器 `medicalDataRouter.ts`、急症判断、输出安全检查
- `geminiHealthConsultation.ts` 的 prompt 内容（证据格式已经是「标题 / 来源 / 链接 / 内容」，`cpg` 直接沿用）
- 现有的测试不准修改，只能新增
- 后端只新增一个 npm 套件也不要；embedding 用现有的 `@google/genai`，数据库用现有的 `pg`

## 4. 分步计划

### [x] 第 1 步｜选资料、下载、建 Python 环境（只新增 `rag-pipeline/`）

**实际做法与记录**：
1. 新建 `rag-pipeline/` 目录结构：
   - `pyproject.toml`：Python ≥ 3.11，配置依赖 `pymupdf>=1.25.0`、`google-genai>=1.0.0`、`psycopg[binary]>=3.2.0`、`python-dotenv>=1.0.0`，开发依赖 `pytest>=8.0.0`。
   - `README.md`：详细记录虚拟环境创建、激活、依赖安装及各脚本运行指南。
   - `.env.example`：提供 `GEMINI_API_KEY=` 与 `DATABASE_URL=`。
   - `.gitignore`：加入 `data/raw/`、`data/chunks/`、`.env`、`.venv/`、`evals/cache/`、`__pycache__/` 等。
2. 官网查证与下载源确认：
   - 官方来源：马来西亚卫生部 MaHTAS 官方公开入口（`https://mymahtas2.moh.gov.my/files/...`）。
   - 6 份最新版指南与 SHA-256：
     - `dengue`: MANAGEMENT OF DENGUE IN ADULTS (FOURTH EDITION) (2026), 17.8MB, SHA256: `2e045e07c1ea995be841c48fcac687642c29d79f0ee04830afbe5b7bec54bc69`
     - `t2dm`: CPG MANAGEMENT OF TYPE 2 DIABETES MELLITUS (6TH EDITION) (2020), 5.9MB, SHA256: `e5157717f79db75ea8a2de6f1f6bd18a3c86216ba824084a0b8cba06813f6b3b`
     - `hypertension`: CPG MANAGEMENT OF HYPERTENSION (5TH EDITION) (2018), 2.0MB, SHA256: `ef5ceea4c50be2a88b80213b0a1c2c8a4ff57171737ea6a0e89e34a85aded2bb`
     - `asthma`: CPG MANAGEMENT OF ASTHMA IN ADULTS (2024), 16.3MB, SHA256: `c1dce4b6907694b3138d0c348acf412df37d92bb3dc74166e18ffae2e2c84be7`
     - `ckd`: CPG MANAGEMENT OF CHRONIC KIDNEY DISEASE (SECOND EDITION) (2018), 1.5MB, SHA256: `44f1023dd04c173227f5056fa8371b472829b1400cfa6780f76aac737ef9e1b3`
     - `dyslipidaemia`: CPG MANAGEMENT OF DYSLIPIDEMIA (6TH EDITION) (2023), 15.8MB, SHA256: `5671aac1f4f9eeff47203208ef66a36db5fc2e285ebc105e2aed82bec366c981`
3. 建立 `rag-pipeline/data/manifest.json`，完整记录 6 份指南信息。
4. 编写 `rag-pipeline/medora_rag/download.py` 并执行下载与哈希校验；重跑幂等跳过验证通过。
5. Python 环境确认：Python 3.14.6 安装 PyMuPDF 2.1 prebuilt wheel 正常运行。
6. 测试验证：新增 `tests/test_manifest.py`（7 个测试全部通过）；后端 19 个测试套件（94 个测试）全部通过。

**做法**：
1. 新建 `rag-pipeline/`：
   - `pyproject.toml`：Python ≥ 3.11，依赖 `pymupdf`、`google-genai`、`psycopg[binary]`、`python-dotenv`，开发依赖 `pytest`
   - `README.md`：这个文件夹做什么、怎么装（`python -m venv .venv` → 安装依赖）、每个脚本怎么跑
   - `.env.example`：`GEMINI_API_KEY=`、`DATABASE_URL=`
   - `.gitignore`（或加进根目录 `.gitignore`）：`data/raw/`、`.env`、`.venv/`、`evals/cache/`
2. 到 MOH 官网找第 2 节的 6 份指南，确认是**最新版**
3. 新建 `rag-pipeline/data/manifest.json`：每份指南写 `doc_id`、`title`、`edition_year`、`source_url`、`sha256`
4. 新建 `rag-pipeline/medora_rag/download.py`：读 manifest，把 PDF 下载到 `data/raw/<doc_id>.pdf`，检查 SHA-256；已经下载、校验码对的就跳过

**允许修改的现有测试**：无（这一步没有现有的 Python 测试）

**完成标准**：
- `python -m medora_rag.download` 能下载 6 份 PDF，重跑一次会全部跳过
- 新增 `tests/test_manifest.py`：manifest 刚好 6 份、`doc_id` 不重复、网址以 `https://` 开头、`sha256` 是 64 位十六进制
- `python -m pytest` 全过
- `git status` 看不到任何 PDF 和 `.env`

**验收重点**：6 个网址都是官方网站、真的打得开；PDF 没有进 Git；Python 3.14 能不能装 pymupdf（不行就在 venv 用 3.12/3.13，写进 README）

### [x] 第 2 步｜PDF 转文字、切块（只改 `rag-pipeline/`）

**实际做法与记录**：
1. 新建 `rag-pipeline/medora_rag/extract.py`：
   - 使用 `pymupdf` 逐页提取文本并保留 1-based 页码（`PageData(page_number, text)`），清理特殊符号与多余空白。
   - 实现 `remove_repeated_headers_footers`：自动统计并去除全书重复页眉页脚、独立页码行，以及章节连续页眉的重复项（保留首次出现以供章节识别）。
2. 新建 `rag-pipeline/medora_rag/chunk.py`：
   - 合并 MaHTAS 双行标题（如 `1.` + `INTRODUCTION`、`Appendix 5` + 标题），按章节标题分段。
   - 自动跳过：封面、出版声明、前言（Foreword）、目录（Table of Contents）、委员会与审稿人名单（Development Group / Review Committee / External Reviewers / Expert Panel）、参考文献（References / Bibliography）、缩写表与致谢。
   - 按句子与段落切块，控制每块 **300～500 个英文单词**（最后一块可短），相邻块保持约 **50 个单词**重叠，保留跨页页码范围 `page_start`～`page_end` 及 SHA-256 `content_hash`。
3. 实际运行 6 份指南切块统计（输出至 `rag-pipeline/data/chunks/<doc_id>.jsonl`，已被 `.gitignore` 忽略）：
   ```text
   doc_id            Pages   Chunks   Avg Words  Min Words  Max Words
   ------------------------------------------------------------------
   dengue              144       66       423.8        226        500
   t2dm                284      187       457.1        269        500
   hypertension        160       78       436.2        246        500
   asthma              112       51       444.5        323        500
   ckd                  68       32       424.3        304        500
   dyslipidaemia       121       85       406.9        284        500
   ------------------------------------------------------------------
   Total chunks across 6 guidelines: 499
   ```
   - 表格与排版观察：纯文本表格按单元格顺序提取成可读词句，未出现字符乱码；抽查 `dengue.jsonl` 的第 0、10、25 块对照原 PDF 对应页码（第 6-7 页、31-33 页、58-59 页），词汇吻合率均为 100.0%。
4. 新增 `rag-pipeline/tests/test_chunk.py`（6 项单元测试），运行 `python -m pytest` 共 13 项测试全过。

**做法**：
1. `medora_rag/extract.py`：用 pymupdf 逐页取出文字，保留页码；去掉每页重复出现的页眉页脚
2. `medora_rag/chunk.py`：
   - 先按章节标题分段，太长的再按段落切，每块约 **300～500 个英文单词**，前后重叠约 **50 个单词**
   - 跳过：封面、目录、参考文献（References）、委员会名单
   - 每块输出：`doc_id`、`chunk_index`、`page_start`、`page_end`、`section`（章节标题）、`content`、`content_hash`（SHA-256）
3. 输出到 `data/chunks/<doc_id>.jsonl`（**这个文件夹也不进 Git**，因为是原文内容）
4. 统计：每份指南几块、平均字数，印在终端

**允许修改的现有测试**：无

**完成标准**：
- 新增 `tests/test_chunk.py`（用自己写的假文字测，不用真的 PDF）：
  - 每块字数在范围内（最后一块可以短）
  - 相邻两块有重叠
  - 页码正确：跨页的块 `page_start < page_end`
  - 参考文献章节被跳过
  - 同样的内容，`content_hash` 一样
- `python -m pytest` 全过
- 真的跑一次 6 份指南，把统计结果贴进这一步的「实际做法」
- 【你做】随便打开 1 份 `jsonl`，看 3 块，确认切出来的是完整、通顺的段落

**验收重点**：表格内容有没有变成乱码（有的话记下来，第一版先接受）；页码对不对（随机抽 3 块对照 PDF）

### [x] 第 3 步｜建数据库表、向量化入库（`sql/` 新增 1 个文件 + `rag-pipeline/`）

**实际做法与记录**：
1. **Gemini Embedding 模型查证**（已同步写入第 7 节）：
   - 模型名称：`gemini-embedding-001`
   - 向量维度：`output_dimensionality=768`（MRL 768 维输出 + L2 归一化）
   - 任务类型：入库使用 `RETRIEVAL_DOCUMENT`，检索使用 `RETRIEVAL_QUERY`
   - 批量上限与免费层限流：单次 API 最多支持 100 条文本，但免费层有每分钟 30,000 tokens（TPM）限制；单个切块约 600～670 tokens，因此预设 `DEFAULT_BATCH_SIZE = 25`（每批约 15,000 tokens），499 块共分 20 批提交并逐批落库。
2. **新增 `consultation-backend/sql/003_cpg_vectors.sql` 并已在 Supabase 执行**：
   - 启用 `vector` 扩展（`create extension if not exists vector;`）
   - 新建 `public.cpg_documents` 与 `public.cpg_chunks`（含 `embedding vector(768)`、generated stored `tsv` 全文检索列、唯一键 `(doc_id, chunk_index)`、HNSW 向量索引 `cpg_chunks_embedding_hnsw_idx` 与 GIN 全文索引 `cpg_chunks_tsv_gin_idx`）
   - 新建混合检索 SQL 函数 `public.match_cpg_chunks(query_embedding vector(768), query_text text, match_count int default 5)`（向量前 20 + 全文前 20，RRF `1 / (60 + rank)` 合并排序）
3. **新增 `rag-pipeline/medora_rag/ingest.py` 与 `rag-pipeline/tests/test_ingest.py`**：
   - 读取 `manifest.json` 与 `data/chunks/*.jsonl`，upsert 到 `cpg_documents` 和 `cpg_chunks`
   - 对比数据库已有 `(doc_id, chunk_index) -> content_hash`，仅对新增或 `content_hash` 改变或无向量的切块调用 `gemini-embedding-001`
   - 内置 429/503 自动解析 `retry in Xs` 退避重试，且每批完成后立即写入数据库 commit
4. **真实入库与二次重跑结果**：
   - 首次入库：`Ingestion complete: total=499 | newly_embedded=499 | skipped=0 | embedding_api_calls=50`（20 个有效批次全部入库，含免费层 TPM 限流退避重试共发起 50 次请求）
   - 二次重跑：`Ingestion complete: total=499 | newly_embedded=0 | skipped=499 | embedding_api_calls=0`（0 次 API 调用）
5. **Supabase `match_cpg_chunks` 混合检索验证**：
   - 执行 `select * from public.match_cpg_chunks((select embedding from public.cpg_chunks where doc_id = 'dengue' and chunk_index = 0 limit 1), 'dengue warning signs', 5);`，成功返回 5 条结果（第 1 条为 `dengue` p.43-45 `8.1 Predictors of Severe Dengue`，score=`0.031319`；第 2 条为 `dengue` p.66-69 `Algorithm 1: Management of Dengue Patients with Warning`，score=`0.029710`）。
6. **测试验证**：
   - `rag-pipeline`：`python -m pytest` 16 项测试全过（含新增 `tests/test_ingest.py` 3 项测试）
   - `consultation-backend`：`npm test` 19 个测试文件（94 项测试）全过

**做法**：
1. **查证**（写进第 7 节）：Gemini 现在的 embedding 模型名称、支不支持指定输出 768 维、`RETRIEVAL_DOCUMENT` / `RETRIEVAL_QUERY` 任务类型、免费额度和一次批量最多几条
2. 新增 `consultation-backend/sql/003_cpg_vectors.sql`：
   - `create extension if not exists vector;`
   - 表 `cpg_documents`：`doc_id`（主键）、`title`、`edition_year`、`source_url`、`ingested_at`
   - 表 `cpg_chunks`：`id`、`doc_id`（外键）、`chunk_index`、`page_start`、`page_end`、`section`、`content`、`content_hash`、`embedding vector(768)`、`embedding_model`、`tsv`（用 `section + content` 生成的英文全文搜索栏位，generated stored）
     - 唯一键 `(doc_id, chunk_index)`
     - 索引：`embedding` 用 HNSW（`vector_cosine_ops`），`tsv` 用 GIN
   - SQL 函数 `match_cpg_chunks(query_embedding vector(768), query_text text, match_count int)`：
     - 向量搜索取前 20、全文搜索取前 20
     - 用 **RRF**（`1 / (60 + 排名)` 加总）合并
     - 回传前 `match_count` 块，带 `doc_id`、`title`、`source_url`、页码、`section`、`content`、分数
3. `medora_rag/ingest.py`：
   - 读 manifest 和 chunks，upsert 到两个表
   - **只对 `content_hash` 变了或还没有向量的块**做 embedding
   - 批量调用、失败重试（429/503 等一下再试，最多 3 次）
   - 印出这次新算了几块、跳过几块
4. 【你做】在 Supabase SQL Editor 执行 `003_cpg_vectors.sql`

**允许修改的现有测试**：无

**完成标准**：
- 新增 `tests/test_ingest.py`（假的 embedding 函数，不连真的 Gemini）：内容没变的块不会再算 embedding；批量大小正确
- 真的跑一次入库，贴出：总块数、embedding 调用次数
- **再跑一次**入库：embedding 调用次数是 **0**
- 在 Supabase 执行一次 `select * from match_cpg_chunks(...)`（用任意一块的向量 + 'dengue warning signs'），能回传结果
- `python -m pytest` 全过；后端 `npm test` 仍全过（没碰后端代码）

**验收重点**：没有改动现有的表；向量维度是 768；重跑不会重复收费

**预计 Gemini 用量**：几百块，批量调用大约 **10～30 次**（实际以第 1 步查证的批量上限为准）

### [x] 第 4 步｜检索评估：先量好，再接进后端（只改 `rag-pipeline/`）

**实际做法与记录**：
1. **新建 `rag-pipeline/evals/golden.jsonl`（共 40 题，用户已审核通过）**：
   - **32 题有答案**：涵盖 6 份指南（`dengue` 6 题、`t2dm` 6 题、`hypertension` 5 题、`asthma` 5 题、`ckd` 5 题、`dyslipidaemia` 5 题），每题含 `id`、`question_zh`、`queries_en`（2 个英文查询词）、`expected`（`doc_id` + 页码范围）及 3 条 `key_facts`。
   - **8 题无答案（`expected: []`）**：偏头痛、湿疹、胃食管反流、急性痛风、肺结核、尿道炎、骨质疏松症、重度抑郁症。
2. **新建 `rag-pipeline/medora_rag/evals/retrieval_eval.py` 与 `rag-pipeline/tests/test_metrics.py`**：
   - 将 80 个英文查询词通过 `gemini-embedding-001`（`RETRIEVAL_QUERY`，768 维 L2 归一化）分 4 批算好向量并缓存至 `rag-pipeline/evals/cache/query_embeddings.json`（已忽略不进 Git，二次重跑 0 次 API 调用）。
   - 对 40 题分别运行 **Vector-Only（纯向量余弦相似度）**、**Keyword-Only（Postgres 全文搜索 `websearch_to_tsquery`）**、**Hybrid（RRF `match_cpg_chunks`）** 三种检索模式。
3. **真实评估数字（见 `rag-pipeline/evals/reports/2026-11-08-retrieval.md`）**：
   | 检索方式 | 有答案题 Hit@5 (32 题) | 有答案题 MRR@5 | 无答案题最高分 (8 题) |
   |---|---:|---:|---:|
   | **Vector-Only (Cosine)** | **0.9688** (31/32) | 0.8490 | 0.648822 |
   | **Keyword-Only (FTS)** | **0.8438** (27/32) | 0.7135 | 0.000610 |
   | **Hybrid (RRF)** | **0.9688** (31/32) | **0.9167** | 0.032522 |
   - **混合检索（Hybrid RRF）的 Hit@5 = 0.9688（≥ 0.8 达标），MRR@5 = 0.9167**（比纯向量 MRR 提升 +0.0677，比纯关键词 Hit@5 提升 +12.5%）。
   - 唯一未命中题目分析：`dyslipidaemia-02`（极高危患者 LDL-C <1.4 mmol/L 目标），黄金标准只标了第 20–22 页和第 72–74 页，但检索器排在第 1–3 名捞出的是同指南第 61 页（Table 12 高强度他汀剂量表）和第 68–69 页（第 9 章二级预防正文，同样明确写着 `Secondary Prevention: < 1.4 mmol/L and a 50% reduction`），未修改题目。
4. **定下第 5 步后端检索参数**：
   - **每次查询取几块（`match_count`）**：定为 **`3`**（Hybrid MRR@5 高达 0.9167，绝大多数命中块排在第 1～2 名，每个英文查询词取前 3 块再配合后端 `MAX_PER_PROVIDER = 4` 去重合并，既能完整覆盖核心证据又节省 prompt token）。
   - **要不要设最低 RRF 分数门槛**：定为 **不设硬性 RRF 分数门槛（`none`）**。原因：`match_cpg_chunks` 的 RRF 分数由相对排名 `1/(60+rank)` 计算（只要有第 1 名向量结果且命中通用医学词如 `treatment`，RRF 分数即接近 `0.032`），无答案题最高 RRF 分数（`0.032522`）与有答案题最低分（`0.032002`）重叠；硬设阈值会误杀有效指南块。在后端多源架构中，`cpg` 与其余 6 个权威 API 并行返回，由问诊模型按相关性择优引用。
5. **测试验证**：`cd rag-pipeline && python -m pytest` 共 20 项测试全部通过（含新增 `tests/test_metrics.py` 4 项指标单元测试）。

**做法**：
1. **出题**：新建 `rag-pipeline/evals/golden.jsonl`，共 **40 题**：
   - **32 题有答案**：每份指南 5～6 题。每题有 `id`、`question_zh`（用户会怎么问）、`queries_en`（1～3 个英文查询词，模仿分流器的输出）、`expected`（正确答案所在的 `doc_id` + 页码范围）、`key_facts`（2～3 个答案重点）
   - **8 题资料里没有**（例如问偏头痛、湿疹）：`expected` 为空，用来检查会不会「硬找」不相关的内容
   - AI 先根据切块起草，**【你做】审核每一题**（大约 20 分钟）
2. `medora_rag/evals/retrieval_eval.py`：对每题跑三种检索方式，计算指标：
   - 方式：**只用向量**、**只用关键词**、**混合（RRF）**
   - 指标：**Hit@5**（前 5 块里有没有正确的页）、**MRR**（正确答案排第几）、没答案的题最高分是多少（看要不要设门槛）
   - 查询向量缓存到 `evals/cache/`
3. 输出报告 `rag-pipeline/evals/reports/2026-MM-DD-retrieval.md`：三种方式的对比表、答错的题和原因
4. 根据结果**定下**：后端每次取几块（预设 3）、要不要设最低分数门槛。写进这一步的「实际做法」

**允许修改的现有测试**：无

**完成标准**：
- 新增 `tests/test_metrics.py`：Hit@5 和 MRR 的计算用固定的例子测
- 报告里有三种方式的真实数字
- **混合检索的 Hit@5 ≥ 0.8**；达不到就停下来汇报，**不要**为了达标改题目
- 【你做】审核完 40 题

**验收重点**：数字是真的跑出来的；题目是在审核后才跑的，不是看结果改题目

**预计 Gemini 用量**：第一次约 **40～100 次** embedding（每个查询词 1 次，之后走缓存）

### [x] 第 5 步｜后端接入 `cpg` 来源 + 前端标签

**做法**：
1. `medicalDataTypes.ts`：`MedicalDataProvider` 加 `'cpg'`
2. 新建 `services/medicalData/providers/mohCpg.ts`：
   - `searchMohCpg(query)`：
     - 没开 `CPG_RAG_ENABLED` 或没有 `DATABASE_URL` → 丢出 `NOT_CONFIGURED`
     - 用 `@google/genai` 算查询向量（`RETRIEVAL_QUERY`、768 维，模型名和第 3 步**一样**）
     - 调用 `match_cpg_chunks`，取第 4 步定下的块数
   - 转成 `MedicalEvidence`：
     - `title`：`MOH CPG: <指南名称>（p. <页码>）`
     - `summary`：切块内容，截到约 800 个字
     - `url`：`<source_url>#page=<page_start>`
   - 查询向量放进**内存缓存**（同一个查询词不重复调用）
   - 数据库连线用现有的 pool（照 `conversationRepository` 的方式），**不要另开连线**
3. `medicalDataService.ts`：
   - `providerSearches` 加 `cpg: searchMohCpg`
   - `providersFor()`：所有类型都把 `'cpg'` 加在**最前面**（这样合并时本地指南优先）
   - **不改** `mergeEvidence` 的上限
4. 前端 `AssistantMessage.tsx`：`PROVIDER_LABELS` 加 `cpg: 'MOH CPG'`
5. `consultation-backend/.env.example`（没有就在 README 写）：`CPG_RAG_ENABLED=false`

**实际做法与记录**：
- 修改 `consultation-backend/src/services/medicalData/medicalDataTypes.ts`：`MedicalDataProvider` 联合类型加入 `'cpg'`。
- 修改 `consultation-backend/src/services/conversationRepository.ts`：导出 `getSharedPgPool(connectionString = process.env.DATABASE_URL)`，复用模块级单例 `pg.Pool` 连线池，不另开新连线。
- 新建 `consultation-backend/src/services/medicalData/providers/mohCpg.ts`：
  - 导出常量：`CPG_EMBEDDING_MODEL = 'gemini-embedding-001'`、`CPG_EMBEDDING_DIM = 768`、`CPG_MATCH_COUNT = 3`。
  - 导出函数：`searchMohCpg(query)`、`createMohCpgSearcher(deps)`、`clearMohCpgEmbeddingCache()`、`normalizeL2(values)`、`formatPgVector(values)`。
  - 当 `CPG_RAG_ENABLED` 不为 `'true'`（或 `'1'`）或缺少 `DATABASE_URL` / `GEMINI_API_KEY` 时抛出 `MedicalHttpError('NOT_CONFIGURED', ...)`。
  - 使用 `@google/genai`（`taskType: 'RETRIEVAL_QUERY'`、`outputDimensionality: 768`）计算并 L2 归一化查询向量，存入内存缓存 `queryEmbeddingCache`；随后通过 `getSharedPgPool()` 调用 `public.match_cpg_chunks($1::vector(768), $2, $3)` 取前 3 块。
  - 映射为 `MedicalEvidence`：`provider: 'cpg'`、`title: 'MOH CPG: <title>（p. <page_start>-<page_end>）'`、`summary` 截断至 800 字、`url: '<source_url>#page=<page_start>'`。
- 修改 `consultation-backend/src/services/medicalData/medicalDataService.ts`：`providerSearches` 注册 `cpg: searchMohCpg`；`providersFor()` 的 `symptom`、`medication`、`disease/general` 三个分支均将 `'cpg'` 置于首位；保留 `mergeEvidence` 原有上限（单来源最多 4 条、总计最多 10 条）。
- 修改 `consultation-frontend/src/chat/AssistantMessage.tsx`：`PROVIDER_LABELS` 新增 `cpg: 'MOH CPG'`。
- 修改 `consultation-backend/.env.example`：新增 `CPG_RAG_ENABLED=false`。
- 新建 `consultation-backend/tests/mohCpg.test.ts`：4 项单元测试全过（未改动任何现有测试文件）；后端 `npm test`（20 files / 98 tests）与 `npm run build` 全过，前端 `npm test`（15 files / 71 tests）与 `npm run build` 全过，未新增任何 npm 套件。
- 单次真实检索验证（本地开启 `CPG_RAG_ENABLED=true`，提问「骨痛热症有什么危险信号？」）：分流产生查询词 `dengue`，调用 1 次 `gemini-embedding-001` 与 Supabase `match_cpg_chunks`，返回的 `evidence` / `sources` 列表前 3 条均为 `provider: 'cpg'`（前端显示标签为 `MOH CPG`）且链接带 `#page=`：
  1. `MOH CPG: MANAGEMENT OF DENGUE IN ADULTS (FOURTH EDITION)（p. 109-120）` → `https://mymahtas2.moh.gov.my/files/CPG%20Dengue4-121026%20%282%29.pdf#page=109`
  2. `MOH CPG: MANAGEMENT OF DENGUE IN ADULTS (FOURTH EDITION)（p. 103-104）` → `https://mymahtas2.moh.gov.my/files/CPG%20Dengue4-121026%20%282%29.pdf#page=103`
  3. `MOH CPG: MANAGEMENT OF DENGUE IN ADULTS (FOURTH EDITION)（p. 42-43）` → `https://mymahtas2.moh.gov.my/files/CPG%20Dengue4-121026%20%282%29.pdf#page=42`

**允许修改的现有测试**：无。如果有现有测试因为 `providersFor` 多了 `'cpg'` 而失败，**停下来汇报**，不要改测试

**完成标准**：
- 新增 `tests/mohCpg.test.ts`（模拟数据库和 embedding）：
  - 关闭时回报 `NOT_CONFIGURED`，其他来源照常
  - 正常时 evidence 的 `title`、`url`（带 `#page=`）、`provider: 'cpg'` 正确
  - 数据库出错时回报错误，其他来源的结果照常回传
  - 同一个查询词第二次不再调用 embedding
- 后端 `npm test`、`npm run build` 全过；前端 `npm test`、`npm run build` 全过
- 本地开 `CPG_RAG_ENABLED=true` 问一次「骨痛热症有什么危险信号？」，回答的来源列表里有 `MOH CPG`（**只问这一次**）

**验收重点**：关掉开关时，行为和现在完全一样；没有新增 npm 套件

### [ ] 第 6 步｜端到端回答评估（小规模）

**做法**：
1. `medora_rag/evals/answer_eval.py`：从 golden 选 **15 题**（每份指南 2～3 题），对**本地后端**发问，开关各跑一次：
   - A：`CPG_RAG_ENABLED=false`（现在的样子）
   - B：`CPG_RAG_ENABLED=true`
2. 用 Gemini 当评审（LLM-as-a-judge），每个回答打分：
   - **重点覆盖**：`key_facts` 有几个说到
   - **忠于资料**：有没有说出资料里没有的具体数字或建议
   - **有没有引用 MOH CPG**（只看 B）
3. 报告 `evals/reports/2026-MM-DD-answers.md`：A、B 对比表，加上 3 个具体例子（同一题 A 和 B 的回答）

**允许修改的现有测试**：无

**完成标准**：
- 报告里有 A、B 两组真实分数
- 【你做】读 3 个例子，判断评审打的分合不合理
- 如果 B 没有比 A 好，**照实写**，并列出可能原因；不要调整到「看起来比较好」

**预计 Gemini 用量**：约 15 题 × 2 组 ×（分流 + 回答 + 评审）≈ **90 次**。开跑前先跟用户确认额度够

### [ ] 第 7 步｜作品集文档 + 部署上线

**做法**：
1. 根目录 `README.md`：在「Authoritative Evidence Retrieval RAG」那一节补上 MOH CPG 向量检索：架构、混合检索、评估数字（链接到报告）
2. `architecture_diagram.html`：检索那一块加上「MOH CPG 向量库（pgvector）」
3. 部署：
   - 【你做】确认线上 Supabase 已经执行 `003_cpg_vectors.sql`，资料已入库（如果线上和本地是同一个数据库，第 3 步已经完成）
   - 【你做】Render 加环境变量 `CPG_RAG_ENABLED=true`
   - 推送到 GitHub，等 Render 和 Vercel 部署完成

**完成标准**（【你做】用手机试）：
- [ ] 问「骨痛热症有什么危险信号？」，来源列表有 `MOH CPG`，点开会到 PDF 对应的页
- [ ] 问一个跟 6 份指南无关的问题（例如湿疹），回答正常，不会硬塞无关的指南内容
- [ ] 把 `CPG_RAG_ENABLED` 改成 `false` 重启，问诊照常（可选）

**验收重点**：这一步由你亲自验收

## 5. 当前进度和下一步

- **当前进度**：第 5 步完成（2026-11-08），后端已接入 `cpg` 来源（`mohCpg.ts`）并在 `providersFor()` 置顶，前端已添加 `MOH CPG` 标签，前后端测试与构建全过，并已完成单次真实检索验证（「骨痛热症有什么危险信号？」返回 3 条带 `#page=` 的 `MOH CPG` 来源），等待验收
- **下一步**：第 6 步（端到端回答评估（小规模））

## 6. 分工

- **【你做】**
  - 确认这份计划
  - 第 2 步：看几块切出来的内容
  - 第 3 步：在 Supabase 执行 SQL
  - 第 4 步：审核 40 题
  - 第 6 步：看评审例子；开跑前确认 Gemini 额度
  - 第 7 步：Render 环境变量、手机验收
- **【AI做】**：写 Python 管线、SQL、后端来源、测试、评估脚本和报告草稿；每完成一步更新本文件进度
- **【一起】**：第 4 步看完检索数字后，决定每次取几块、要不要设门槛

## 7. 关键假设和需要查证的事

- ✅ **Gemini embedding 模型**（第 3 步已查证）：
  - **模型名称**：`gemini-embedding-001`（官方当前主力 embedding 模型，取代旧版 `text-embedding-004`）。
  - **768 维输出**：原生默认 3072 维，支持通过 Matryoshka Representation Learning (MRL) 指定 `output_dimensionality=768`（`outputDimensionality: 768`），截断后做 L2 归一化即可保持高检索精度。
  - **任务类型**：支持 `task_type="RETRIEVAL_DOCUMENT"`（文档切块入库）与 `task_type="RETRIEVAL_QUERY"`（用户查询检索）。
  - **批量上限**：单次 `embed_content` / `batchEmbedContents` 请求最多支持 **100 条**文本（超过 100 条会返回 `400 Bad Request`）；考虑到免费层 TPM 30,000 上限（每块约 650 tokens），本管线预设每批 `DEFAULT_BATCH_SIZE=25`（约 15,000 tokens/批），499 个切块分 **20 批**完成入库。
  - **免费额度与限流**：免费层按每分钟处理的文本与 token 数（RPM 约 100、TPM 30,000、RPD 1,000）计量，单条文本上限 2,048 tokens；`medora_rag/ingest.py` 已内置 429/503 自动解析 `retry in Xs` 退避重试。
- ✅ **Supabase 能开 pgvector**（第 3 步已验证）：Supabase 已启用 `vector` 扩展并完成 HNSW 索引与 `match_cpg_chunks` 函数创建。
- ✅ **MOH CPG 下载**（第 1 步已查证）：6 份最新版均已从 MaHTAS 官网下载并校验 SHA-256。
- ✅ **使用条款**（第 1 步已查证）：MOH CPG 公开供临床与公众参考，仅做检索短摘录并附官方 PDF 链接，PDF 原件不进 Git 仓库。
- ✅ **pymupdf 授权是 AGPL**（第 1 步已确认）：仅用于本地离线提取脚本，不随线上后端部署。
- ✅ **Python 3.14**（第 1 步已确认）：Python 3.14.6 可直接安装 `pymupdf 2.1`、`psycopg[binary]`、`google-genai` 预编译 wheel 并通过全部测试。
- ⏳ **线上和本地是不是同一个 Supabase 数据库** → 第 3 步问用户
- 假设：分流器产生的英文查询词足够用来查英文指南；第 4 步的评估会验证这一点

## 8. 暂不做（以后再讨论）

- 法律 RAG（用户之后想做的第二个作品）
- 超过 6 份的指南、马来文资料、自动检查指南有没有新版
- 专门的重排序模型（reranker）
- 修改 prompt 让模型「优先采用本地指南」
- 管理后台、上传新 PDF 的界面
- 用 LangGraph 重写问诊流程（另一份计划）

## 9. 【执行限制】

- 完成标准：<当前这一步在「4. 分步计划」里写的「完成标准」>，达到立即停止，不顺手优化别的
- 范围：只看与问题直接相关的文件，不扫全项目，不用子代理
- 次数：最多「修改 → 验证」2 轮；同一错误出现 2 次直接停
- 禁止：为了通过而修改 / 删除 / 跳过测试，或降低验证标准；为了让评估数字好看而改题目
- 真实调用 Gemini 前，先说预计调用几次
- 停止时汇报：做了什么、当前证据、卡在哪、建议下一步（由我决定是否继续）

> 补充：这一批每一步的「允许修改的现有测试」都是「无」。新的测试一律放在新文件，不准改动旧测试。

## 10. 新对话开场白（开发用）

> 先读 PLAN.md 和现有代码，用 3 句话复述项目和当前进度。
> 我确认后，只做第 N 步，按完成标准验证，并更新 PLAN.md 进度。
> 做完后停下来等验收，不要自己提交。

## 11. 【验收流程】

每一步做完都要验收，**不能由做的那个对话自己验收**。

- **流程**：开发对话做第 N 步 → 开一个**全新的**验收对话检查 → 用户看结论决定 → 通过就提交 → 下一步
- **不通过**：把验收员列出的问题贴回开发对话修，修完再开一个新的验收对话检查（修的次数算在执行限制的「最多 2 轮」里）
- **验收对话必须是全新的对话**，不能继承开发对话的记忆；能换模型就换成和开发不同的模型
- **每一步验收通过后马上提交**；**第 7 步之前不要推送**

### 验收开场白（把 N 换成步骤号）

> 你是验收员，不是开发者。只检查，**不准修改任何文件**。
> 1. 读 PLAN.md 第 N 步的「做法」「允许修改的现有测试」「完成标准」「验收重点」，以及第 3 节（护栏）和第 9 节（执行限制）。
> 2. 运行 `git status` 和 `git diff`，列出改了哪些文件，指出计划以外的改动；确认没有 PDF、切块内容或 `.env` 被加进 Git。
> 3. 检查测试文件的改动：有没有修改、删除或跳过不在「允许修改」清单里的测试。
> 4. 自己运行测试命令，贴出结果摘要；不要只看之前的对话说通过了。**不要**重跑会调用 Gemini 的评估脚本，只检查报告和缓存。
> 5. 逐条对照完成标准，每条标 ✅ 或 ❌，并附上证据（文件、行号或测试名称）。
> 6. 检查 PLAN.md 这一步是否打了 [x]，并记录了实际的做法和名称。
>
> 最后给出结论：**通过** 或 **不通过**。不通过时，列出要修的具体项目。
