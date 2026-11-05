-- ==============================================================================
-- 001_conversations.sql
-- AI Doctor Assistant: Multi-conversation persistence & messages schema
-- ==============================================================================

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  active_category text,
  active_emergency jsonb,
  topic_messages jsonb not null default '[]'::jsonb,
  last_evidence jsonb not null default '[]'::jsonb,
  last_search_queries jsonb not null default '[]'::jsonb,
  message_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_user_updated_idx on public.conversations (user_id, updated_at desc);
create index if not exists conversations_updated_idx on public.conversations (updated_at);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,            -- 给 AI 看的纯文字（AI 回答用 formatAnswerForHistory 转换）
  answer jsonb,                     -- AI 的完整结构化回答，前端还原显示用
  sources jsonb,                    -- 参考资料列表
  is_emergency boolean not null default false,
  map_care_level text check (map_care_level in ('hospital', 'clinic')),  -- 第 6 步使用
  use_for_context boolean not null default true,  -- false = 安全检查没通过的兜底回答，不交给 AI
  created_at timestamptz not null default now()
);

create index if not exists conversation_messages_conv_created_idx on public.conversation_messages (conversation_id, created_at);

-- 后端用 postgres 身份连接，不受 RLS 影响；开启 RLS 是为了挡住 Supabase 公开接口的未授权访问
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
