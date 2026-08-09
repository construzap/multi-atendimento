-- Separa memórias:
-- - chat_messages         → n8n Postgres Chat Memory (message jsonb)
-- - chat_messages_agente  → agente Nuxt (role/message text/tool_*)

-- 1) Tabela atual (schema Nuxt) vira chat_messages_agente
do $$
begin
  if to_regclass('public.chat_messages') is not null
     and to_regclass('public.chat_messages_agente') is null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'chat_messages' and column_name = 'role'
     )
  then
    alter table public.chat_messages rename to chat_messages_agente;

    if to_regclass('public.chat_messages_id_seq') is not null then
      alter sequence public.chat_messages_id_seq rename to chat_messages_agente_id_seq;
    end if;

    if exists (
      select 1 from pg_constraint
      where conname = 'chat_messages_pkey'
        and conrelid = 'public.chat_messages_agente'::regclass
    ) then
      alter table public.chat_messages_agente
        rename constraint chat_messages_pkey to chat_messages_agente_pkey;
    end if;

    if exists (
      select 1 from pg_constraint
      where conname = 'chat_messages_workspace_id_fkey'
        and conrelid = 'public.chat_messages_agente'::regclass
    ) then
      alter table public.chat_messages_agente
        rename constraint chat_messages_workspace_id_fkey to chat_messages_agente_workspace_id_fkey;
    end if;

    if exists (
      select 1 from pg_constraint
      where conname = 'chat_messages_role_check'
        and conrelid = 'public.chat_messages_agente'::regclass
    ) then
      alter table public.chat_messages_agente
        rename constraint chat_messages_role_check to chat_messages_agente_role_check;
    end if;

    if exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'idx_chat_messages_session_created'
    ) then
      alter index public.idx_chat_messages_session_created
        rename to idx_chat_messages_agente_session_created;
    end if;

    if exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'idx_chat_messages_workspace_created'
    ) then
      alter index public.idx_chat_messages_workspace_created
        rename to idx_chat_messages_agente_workspace_created;
    end if;
  end if;
end $$;

-- 2) Restaura chat_messages_n8n_legacy como chat_messages
do $$
begin
  if to_regclass('public.chat_messages_n8n_legacy') is not null
     and to_regclass('public.chat_messages') is null
  then
    alter table public.chat_messages_n8n_legacy rename to chat_messages;

    if to_regclass('public.chat_messages_n8n_legacy_id_seq') is not null then
      alter sequence public.chat_messages_n8n_legacy_id_seq rename to chat_messages_id_seq;
    end if;

    if exists (
      select 1 from pg_constraint
      where conname = 'chat_messages_n8n_legacy_pkey'
        and conrelid = 'public.chat_messages'::regclass
    ) then
      alter table public.chat_messages
        rename constraint chat_messages_n8n_legacy_pkey to chat_messages_pkey;
    end if;
  end if;
end $$;

-- 3) Fallback: cria chat_messages no formato n8n se ainda não existir
create table if not exists public.chat_messages (
  id serial primary key,
  session_id varchar not null,
  message jsonb not null
);

comment on table public.chat_messages is
  'Memória LangChain do n8n (Postgres Chat Memory). Colunas: id, session_id, message jsonb.';

comment on table public.chat_messages_agente is
  'Histórico do agente Nuxt (POST /api/public/agente/responder).';
