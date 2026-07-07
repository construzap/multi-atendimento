-- Log detalhado de cada POST /api/webhook (Uazapi).
-- DDL já aplicado no Supabase; mantido no repo como referência.

create table if not exists public.webhook_uazapi_execucoes (
  id uuid primary key default gen_random_uuid(),

  workspace_id bigint null references public.workspace (id) on delete set null,
  id_canal bigint null references public.canais (id) on delete set null,

  event_type text null,
  instance_name text null,
  token_prefix text null,

  status text not null default 'processando'
    check (status in ('processando', 'ignorado', 'sucesso', 'erro')),
  motivo_ignorado text null,
  erro_etapa text null,
  erro_mensagem text null,

  message_id text null,
  conversa_key text null,

  request_url text null,
  user_agent text null,

  etapas jsonb not null default '[]'::jsonb,
  payload jsonb null,
  resposta jsonb null,

  iniciado_em timestamptz not null default now(),
  finalizado_em timestamptz null,
  duracao_ms integer null,

  created_at timestamptz not null default now()
);

comment on table public.webhook_uazapi_execucoes is
  'Auditoria de execuções do webhook Uazapi (POST /api/webhook).';

create index if not exists idx_webhook_uazapi_exec_workspace_created
  on public.webhook_uazapi_execucoes (workspace_id, created_at desc);

create index if not exists idx_webhook_uazapi_exec_canal_created
  on public.webhook_uazapi_execucoes (id_canal, created_at desc);

create index if not exists idx_webhook_uazapi_exec_status_created
  on public.webhook_uazapi_execucoes (status, created_at desc);

create index if not exists idx_webhook_uazapi_exec_message_id
  on public.webhook_uazapi_execucoes (message_id)
  where message_id is not null;

alter table public.webhook_uazapi_execucoes enable row level security;
