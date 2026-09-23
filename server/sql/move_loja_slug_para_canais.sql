-- Move loja_slug de workspace para canais.
-- Rodar no SQL Editor do Supabase. NÃO executar automaticamente pelo app.
-- Depois rode também server/sql/loja_cardapio.sql (a RPC passa a receber workspace_id).

-- ---------------------------------------------------------------------------
-- 1) canais.loja_slug
-- ---------------------------------------------------------------------------

alter table public.canais
  add column if not exists loja_slug text null;

comment on column public.canais.loja_slug is
  'Identificador público da loja na URL /loja/:slug. Único quando preenchido.';

create unique index if not exists canais_loja_slug_uidx
  on public.canais (loja_slug)
  where loja_slug is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'canais_loja_slug_formato_chk'
  ) then
    alter table public.canais
      add constraint canais_loja_slug_formato_chk
      check (
        loja_slug is null
        or loja_slug ~ '^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$'
      );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Copia o slug antigo do workspace para o canal mais antigo (não apagado).
--    Se o workspace tiver vários canais, só o de menor id recebe o slug.
--    Revise depois se o canal certo ficou com o slug.
-- ---------------------------------------------------------------------------

update public.canais c
set loja_slug = lower(trim(both from w.loja_slug))
from public.workspace w
where w.id = c.workspace_id
  and w.loja_slug is not null
  and c.deleted_at is null
  and c.loja_slug is null
  and c.id = (
    select c2.id
    from public.canais c2
    where c2.workspace_id = w.id
      and c2.deleted_at is null
    order by c2.id
    limit 1
  );

-- ---------------------------------------------------------------------------
-- 3) Remove loja_slug e loja_ativa de workspace
-- ---------------------------------------------------------------------------

alter table public.workspace
  drop constraint if exists workspace_loja_slug_formato_chk;

drop index if exists public.workspace_loja_slug_uidx;

alter table public.workspace
  drop column if exists loja_slug,
  drop column if exists loja_ativa;
