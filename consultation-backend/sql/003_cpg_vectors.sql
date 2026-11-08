-- ==============================================================================
-- 003_cpg_vectors.sql
-- MOH Clinical Practice Guidelines (CPG) Vector & Hybrid Search Schema (pgvector)
-- ==============================================================================

create extension if not exists vector;

create table if not exists public.cpg_documents (
  doc_id text primary key,
  title text not null,
  edition_year integer not null,
  source_url text not null,
  ingested_at timestamptz not null default now()
);

create table if not exists public.cpg_chunks (
  id bigserial primary key,
  doc_id text not null references public.cpg_documents(doc_id) on delete cascade,
  chunk_index integer not null,
  page_start integer not null,
  page_end integer not null,
  section text not null,
  content text not null,
  content_hash text not null,
  embedding vector(768),
  embedding_model text not null default 'gemini-embedding-001',
  tsv tsvector generated always as (
    to_tsvector('english', coalesce(section, '') || ' ' || coalesce(content, ''))
  ) stored,
  unique (doc_id, chunk_index)
);

create index if not exists cpg_chunks_embedding_hnsw_idx
  on public.cpg_chunks
  using hnsw (embedding vector_cosine_ops);

create index if not exists cpg_chunks_tsv_gin_idx
  on public.cpg_chunks
  using gin (tsv);

alter table public.cpg_documents enable row level security;
alter table public.cpg_chunks enable row level security;

create or replace function public.match_cpg_chunks(
  query_embedding vector(768),
  query_text text,
  match_count int default 5
)
returns table (
  id bigint,
  doc_id text,
  title text,
  edition_year integer,
  source_url text,
  chunk_index integer,
  page_start integer,
  page_end integer,
  section text,
  content text,
  score double precision
)
language sql
stable
as $$
  with q as (
    select
      plainto_tsquery('english', coalesce(query_text, '')) as q_and,
      replace(plainto_tsquery('english', coalesce(query_text, ''))::text, ' & ', ' | ')::tsquery as q_or
  ),
  vec_matches as (
    select
      c.id,
      row_number() over (order by c.embedding <=> query_embedding asc) as vec_rank
    from public.cpg_chunks c
    where query_embedding is not null
      and c.embedding is not null
    order by c.embedding <=> query_embedding asc
    limit 20
  ),
  fts_matches as (
    select
      c.id,
      row_number() over (
        order by
          (case when c.tsv @@ q.q_and then 1 else 0 end) desc,
          ts_rank_cd(c.tsv, q.q_or) desc,
          c.id asc
      ) as fts_rank
    from public.cpg_chunks c
    cross join q
    where numnode(q.q_or) > 0
      and c.tsv @@ q.q_or
    order by
      (case when c.tsv @@ q.q_and then 1 else 0 end) desc,
      ts_rank_cd(c.tsv, q.q_or) desc,
      c.id asc
    limit 20
  ),
  combined as (
    select
      coalesce(v.id, f.id) as chunk_id,
      (
        coalesce(1.0 / (60 + v.vec_rank), 0.0) +
        coalesce(1.0 / (60 + f.fts_rank), 0.0)
      )::double precision as rrf_score
    from vec_matches v
    full outer join fts_matches f on v.id = f.id
  )
  select
    c.id,
    c.doc_id,
    d.title,
    d.edition_year,
    d.source_url,
    c.chunk_index,
    c.page_start,
    c.page_end,
    c.section,
    c.content,
    combined.rrf_score as score
  from combined
  join public.cpg_chunks c on c.id = combined.chunk_id
  join public.cpg_documents d on d.doc_id = c.doc_id
  order by combined.rrf_score desc, c.id asc
  limit greatest(coalesce(match_count, 5), 1);
$$;
