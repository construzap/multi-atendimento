-- Memória LangChain do n8n (Postgres Chat Memory).
-- Colunas esperadas pelo nó: id, session_id, message (jsonb).

create table if not exists public.chat_messages (
  id serial primary key,
  session_id varchar not null,
  message jsonb not null
);

comment on table public.chat_messages is
  'Memória LangChain do n8n (Postgres Chat Memory). Colunas: id, session_id, message jsonb.';
