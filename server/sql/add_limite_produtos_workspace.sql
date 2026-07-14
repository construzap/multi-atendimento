-- Limite de produtos por workspace (`null` = sem limite).
alter table public.workspace
  add column if not exists limite_produtos integer null;

comment on column public.workspace.limite_produtos is
  'Máximo de produtos permitidos no workspace. NULL = sem limite.';
