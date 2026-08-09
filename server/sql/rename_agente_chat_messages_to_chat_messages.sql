-- Renomeia agente_chat_messages -> chat_messages.
-- Preserva a tabela N8N antiga (message jsonb) como chat_messages_n8n_legacy.

do $$
begin
  if to_regclass('public.chat_messages') is not null
     and to_regclass('public.agente_chat_messages') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'chat_messages'
         and column_name = 'message'
     )
  then
    alter table public.chat_messages rename to chat_messages_n8n_legacy;

    if exists (
      select 1 from pg_constraint
      where conname = 'chat_messages_pkey'
        and conrelid = 'public.chat_messages_n8n_legacy'::regclass
    ) then
      alter table public.chat_messages_n8n_legacy
        rename constraint chat_messages_pkey to chat_messages_n8n_legacy_pkey;
    end if;

    if to_regclass('public.chat_messages_id_seq') is not null then
      alter sequence public.chat_messages_id_seq rename to chat_messages_n8n_legacy_id_seq;
    end if;
  end if;
end $$;

do $$
begin
  if to_regclass('public.agente_chat_messages') is not null
     and to_regclass('public.chat_messages') is null
  then
    alter table public.agente_chat_messages rename to chat_messages;

    if to_regclass('public.agente_chat_messages_id_seq') is not null then
      alter sequence public.agente_chat_messages_id_seq rename to chat_messages_id_seq;
    end if;

    if exists (
      select 1 from pg_constraint
      where conname = 'agente_chat_messages_pkey'
        and conrelid = 'public.chat_messages'::regclass
    ) then
      alter table public.chat_messages rename constraint agente_chat_messages_pkey to chat_messages_pkey;
    end if;

    if exists (
      select 1 from pg_constraint
      where conname = 'agente_chat_messages_workspace_id_fkey'
        and conrelid = 'public.chat_messages'::regclass
    ) then
      alter table public.chat_messages
        rename constraint agente_chat_messages_workspace_id_fkey to chat_messages_workspace_id_fkey;
    end if;

    if exists (
      select 1 from pg_constraint
      where conname = 'agente_chat_messages_role_check'
        and conrelid = 'public.chat_messages'::regclass
    ) then
      alter table public.chat_messages
        rename constraint agente_chat_messages_role_check to chat_messages_role_check;
    end if;

    if exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'idx_agente_chat_messages_session_created'
    ) then
      alter index public.idx_agente_chat_messages_session_created
        rename to idx_chat_messages_session_created;
    end if;

    if exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'idx_agente_chat_messages_workspace_created'
    ) then
      alter index public.idx_agente_chat_messages_workspace_created
        rename to idx_chat_messages_workspace_created;
    end if;
  end if;
end $$;

comment on table public.chat_messages is
  'Histórico de mensagens do agente IA (substitui Postgres Chat Memory do N8N no app).';
