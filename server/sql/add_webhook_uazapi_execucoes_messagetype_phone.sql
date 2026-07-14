-- Tipo da mensagem (ex.: audioMessage, imageMessage) e telefone gravado em conversas.phone.
alter table public.webhook_uazapi_execucoes
  add column if not exists messagetype text null;

alter table public.webhook_uazapi_execucoes
  add column if not exists phone text null;

comment on column public.webhook_uazapi_execucoes.messagetype is
  'Tipo normalizado da mensagem (campo messagetype / messatype).';

comment on column public.webhook_uazapi_execucoes.phone is
  'Telefone ou id de grupo persistido em conversas.phone.';

create index if not exists idx_webhook_uazapi_exec_phone
  on public.webhook_uazapi_execucoes (phone)
  where phone is not null;

create index if not exists idx_webhook_uazapi_exec_messagetype
  on public.webhook_uazapi_execucoes (messagetype)
  where messagetype is not null;
