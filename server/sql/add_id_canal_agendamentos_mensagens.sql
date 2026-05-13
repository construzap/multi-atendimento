-- Executar no Supabase antes de gravar agendamentos com canal de envio.
alter table public.agendamentos_mensagens
  add column if not exists id_canal integer references public.canais (id);

create index if not exists agendamentos_mensagens_id_canal_idx on public.agendamentos_mensagens (id_canal);

comment on column public.agendamentos_mensagens.id_canal is
  'Canal WhatsApp (canais.id) a partir do qual a mensagem agendada será enviada.';
