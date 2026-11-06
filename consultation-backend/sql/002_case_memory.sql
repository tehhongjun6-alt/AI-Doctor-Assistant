-- 002_case_memory.sql: 为对话表添加病情摘要及进度追踪列
alter table public.conversations
  add column if not exists case_summary jsonb,
  add column if not exists case_summary_upto integer not null default 0;
