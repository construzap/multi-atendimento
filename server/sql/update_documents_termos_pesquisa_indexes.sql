-- Índices na vector store de termos (Supabase Vector — NUXT_VECTOR_SUPABASE_URL).
-- Rodar se a tabela documents_termos_pesquisa já existir sem estes índices.

create index if not exists documents_termos_pesquisa_workspace_idx
  on public.documents_termos_pesquisa ((metadata->>'workspace_id'));

create index if not exists documents_termos_pesquisa_termo_id_idx
  on public.documents_termos_pesquisa ((metadata->>'termo_id'));

comment on index public.documents_termos_pesquisa_workspace_idx is
  'Filtro por loja (metadata.workspace_id) em sync, status e cleanup.';

comment on index public.documents_termos_pesquisa_termo_id_idx is
  'Lookup/delete por termo (metadata.termo_id) no upsert incremental.';
