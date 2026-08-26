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
-- View deduplicada: um termo por id, ligado a produto/variação com status=true.
-- Inclui workspace_id para indexação e filtros por loja.
-- =============================================================================

create or replace view public.view_termos_pesquisa_em_uso as
select distinct
  t.id,
  t.nome,
  t.workspace_id
from public.produto_termo_de_pesquisa t
inner join public.produto_termo_de_pesquisa_vinculo v on v.termo_id = t.id
inner join public.produtos_workspace p on p.id = v.produto_id
where p.status = true;

comment on view public.view_termos_pesquisa_em_uso is
  'Termos em uso (produtos/variações ativos), dedupe por termo.id, com workspace_id.';
