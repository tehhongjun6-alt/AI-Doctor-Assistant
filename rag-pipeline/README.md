# Medora MOH CPG RAG Pipeline

本目录包含 Medora 问诊助手的马来西亚卫生部临床实践指南（MOH CPG）资料处理与向量检索离线管线。

## 目录用途

1. **资料下载（`medora_rag.download`）**：依据 `data/manifest.json` 自动从 MOH MaHTAS 官方网站下载 CPG 指南 PDF，并做 SHA-256 完整性校验。
2. **文本提取与切块（`medora_rag.extract` / `chunk`）**：使用 PyMuPDF 解析 PDF 内容，提取章节与页码并切块。
3. **向量化入库（`medora_rag.ingest`）**：调用 Gemini embedding 模型计算切块向量，存入 Supabase pgvector 数据库。
4. **评估测试（`evals/`）**：对 RAG 检索质量进行 Hit@5、MRR 以及问答效果的离线评估。

## 环境要求与安装

- Python ≥ 3.11（已在 Python 3.14.6 与 Python 3.11.18 测试通过，pymupdf 2.1 支持 Python 3.14 prebuilt wheel）
- 建议使用虚拟环境进行依赖隔离：

```bash
cd rag-pipeline

# 创建虚拟环境
python -m venv .venv

# 激活虚拟环境 (Windows PowerShell)
.venv\Scripts\Activate.ps1
# 或 Windows CMD:
# .venv\Scripts\activate.bat

# 安装核心依赖与开发测试依赖
pip install -e ".[dev]"
```

## 环境变量配置

复制 `.env.example` 并填入必要密钥：

```bash
cp .env.example .env
```

- `GEMINI_API_KEY`: Google Gemini API Key（用于后续计算切块向量）
- `DATABASE_URL`: Supabase PostgreSQL 连接字符串（包含 pgvector 扩展）

## 脚本运行说明

### 1. 下载 MOH CPG 指南 PDF
从官网下载 6 份 CPG PDF 到 `data/raw/`：
```bash
python -m medora_rag.download
```
*注：脚本具有幂等性。若文件已存在且 SHA-256 校验码一致，将自动跳过下载。*

### 2. 提取 PDF 文本并切块
将 6 份 PDF 去页眉页脚、按章节分段并切块（300～500 词，50 词重叠），输出至 `data/chunks/<doc_id>.jsonl`：
```bash
python -m medora_rag.chunk
```

### 3. 向量化入库（Supabase pgvector）
先在 Supabase SQL Editor 执行 `../consultation-backend/sql/003_cpg_vectors.sql`，再运行入库脚本：
```bash
python -m medora_rag.ingest
```
*注：脚本仅对新增或 `content_hash` 发生变化的切块调用 Gemini embedding，未变化的切块将自动跳过。*

### 4. 运行自动化测试
```bash
python -m pytest
```
