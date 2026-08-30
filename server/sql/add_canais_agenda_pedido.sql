-- Agenda de pedido quando a loja está fechada (`canais.agenda_pedido`).
alter table public.canais
  add column if not exists agenda_pedido boolean not null default false;

comment on column public.canais.agenda_pedido is
  'Se true, permite agendar pedido com a loja fechada; usado quando loja_aberta = false.';
