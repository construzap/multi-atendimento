-- Loja pública: slug da URL (/loja/:slug) + flag se a vitrine está ativa.
-- Rodar no SQL Editor do Supabase.

alter table public.workspace
  add column if not exists loja_slug text null,
  add column if not exists loja_ativa boolean not null default false;

comment on column public.workspace.loja_slug is
  'Identificador público da loja na URL /loja/:slug. Único quando preenchido.';

comment on column public.workspace.loja_ativa is
  'Se true, a loja pública pode ser servida; se false, endpoints públicos devem recusar.';

-- Índice único: permite vários NULL, mas um slug só pode pertencer a um workspace.
create unique index if not exists workspace_loja_slug_uidx
  on public.workspace (loja_slug)
  where loja_slug is not null;

-- Formato básico do slug (letras minúsculas, números, hífen; 2–64 chars).
-- Só valida quando loja_slug não é null.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workspace_loja_slug_formato_chk'
  ) then
    alter table public.workspace
      add constraint workspace_loja_slug_formato_chk
      check (
        loja_slug is null
        or loja_slug ~ '^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$'
      );
  end if;
end $$;
