-- =============================================================================
-- PARTE A — Supabase Vector (NUXT_VECTOR_SUPABASE_URL)
-- Tabela pgvector para termos de pesquisa em uso.
-- Dimensão 1536 = text-embedding-3-small (mesmo modelo dos produtos).
-- =============================================================================

create extension if not exists vector;

create table if not exists public.documents_termos_pesquisa (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536) not null
);

create index if not exists documents_termos_pesquisa_workspace_idx
  on public.documents_termos_pesquisa ((metadata->>'workspace_id'));

create index if not exists documents_termos_pesquisa_termo_id_idx
  on public.documents_termos_pesquisa ((metadata->>'termo_id'));

create index if not exists documents_termos_pesquisa_embedding_idx
  on public.documents_termos_pesquisa
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

comment on table public.documents_termos_pesquisa is
  'Vector store de termos de pesquisa. content = nome do termo; metadata.workspace_id e metadata.termo_id.';

-- =============================================================================
-- PARTE B — Banco principal da aplicação (Supabase app)
-- View detalhada de termos; o sync filtra `em_uso = true`.
-- =============================================================================

create or replace view public.view_termos_pesquisa_detalhada
with (security_invoker = on) as
select
  t.id,
  t.nome,
  t.workspace_id,
  count(v.produto_id) filter (where p.status = true) as total_usos,
  coalesce(
    json_agg(json_build_object('id', p.id, 'nome', p.nome)) filter (
      where p.id is not null and p.status = true
    ),
    '[]'::json
  ) as produtos,
  case
    when count(v.produto_id) filter (where p.status = true) > 0 then true
    else false
  end as em_uso
from public.produto_termo_de_pesquisa t
left join public.produto_termo_de_pesquisa_vinculo v on v.termo_id = t.id
left join public.produtos_workspace p on p.id = v.produto_id
group by t.id, t.nome, t.workspace_id;

comment on view public.view_termos_pesquisa_detalhada is
  'Termos com total_usos, produtos ativos e flag em_uso (sync vector store usa em_uso = true).';

-- Opcional: remover view antiga se existir
-- drop view if exists public.view_termos_pesquisa_em_uso;
