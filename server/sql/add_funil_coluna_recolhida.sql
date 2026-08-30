-- Coluna recolhida no board Kanban (`true` = estreita / fechada).
alter table public.funil_workspace_colunas
  add column if not exists recolhida boolean not null default false;

comment on column public.funil_workspace_colunas.recolhida is
  'Se true, a coluna aparece recolhida no Kanban; false = aberta.';
