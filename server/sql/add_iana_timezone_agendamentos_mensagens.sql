-- Executar no Supabase (SQL editor ou migração) antes de usar POST /api/agendamento-de-mensagem com fuso explícito.
alter table public.agendamentos_mensagens
  add column if not exists iana_timezone text not null default 'America/Sao_Paulo';

comment on column public.agendamentos_mensagens.iana_timezone is
  'Fuso IANA em que data/hora locais do agendamento foram escolhidos (ex.: America/Sao_Paulo).';
