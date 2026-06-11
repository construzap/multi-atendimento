-- Coluna que aponta para o prompt principal do workspace (`prompt_workspace.id`).
alter table public.workspace
  add column if not exists prompt_principal bigint null;

alter table public.workspace
  drop constraint if exists workspace_prompt_principal_fkey;

alter table public.workspace
  add constraint workspace_prompt_principal_fkey
  foreign key (prompt_principal)
  references public.prompt_workspace (id)
  on delete set null;

create index if not exists idx_workspace_prompt_principal
  on public.workspace using btree (prompt_principal);
