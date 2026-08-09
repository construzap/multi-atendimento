-- Memória do agent loop Nuxt (POST /api/public/agente/responder).
-- session_id = "{workspace_id}-{conversa_key}"

create table if not exists public.chat_messages_agente (
  id bigserial primary key,
  session_id text not null,
  workspace_id bigint null references public.workspace (id) on delete set null,
  role text not null
    check (role in ('user', 'assistant', 'tool', 'system')),
  message text null,
  tool_calls jsonb null,
  tool_call_id text null,
  name text null,
  created_at timestamptz not null default now()
);

comment on table public.chat_messages_agente is
  'Histórico do agente Nuxt (POST /api/public/agente/responder).';

create index if not exists idx_chat_messages_agente_session_created
  on public.chat_messages_agente (session_id, created_at asc);

create index if not exists idx_chat_messages_agente_workspace_created
  on public.chat_messages_agente (workspace_id, created_at desc)
  where workspace_id is not null;
