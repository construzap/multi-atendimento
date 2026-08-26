-- Atualiza a view de termos em uso (garante workspace_id na listagem).
-- Rodar no banco principal da aplicação.

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

-- Índices na vector store (Supabase Vector — NUXT_VECTOR_SUPABASE_URL):
-- Ver server/sql/update_documents_termos_pesquisa_indexes.sql
