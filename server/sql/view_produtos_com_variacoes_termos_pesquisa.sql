-- Recria a view de listagem: termo único em produtos_workspace.termo_pesquisa.
-- Pré-requisitos: produto_termo_de_pesquisa, coluna termo_pesquisa bigint em produtos_workspace.
--
-- O tipo de `termos_pesquisa` na view é json; o Postgres não permite CREATE OR REPLACE se mudar o tipo.

drop view if exists public.view_produtos_com_variacoes;

create view public.view_produtos_com_variacoes
with (security_invoker = on) as
select
  p.id,
  p.workspace_id,
  p.nome,
  p.sku,
  p.unidade_venda,
  p.marca,
  p.preco,
  p.preco_prazo,
  p.peso_kg,
  p.estoque,
  p.imagem_url,
  p.infos_relevantes,
  p.status,
  p.created_at,
  p.updated_at,
  p.codigo,
  p.categoria_id,
  p.descricao,
  p.codigo_ncm,
  coalesce(
    (
      select json_build_object('id', t.id, 'nome', t.nome)
      from public.produto_termo_de_pesquisa t
      where t.id = p.termo_pesquisa
    ),
    null::json
  ) as termos_pesquisa,
  (
    select t.nome
    from public.produto_termo_de_pesquisa t
    where t.id = p.termo_pesquisa
  ) as termos_pesquisa_busca,
  p.preco_custo,
  p.preco_promocional,
  p.codigo_barras_ean,
  p.largura,
  p.altura,
  p.comprimento,
  p.parent_id,
  p.tem_variacoes,
  p.atributos,
  coalesce(
    (
      select to_jsonb(c.*)
      from public.produto_categorias c
      where c.id = p.categoria_id
    ),
    null::jsonb
  ) as categoria,
  coalesce(
    (
      select json_agg(img.*)
      from public.produto_imagens img
      where img.produto_id = p.id
    ),
    '[]'::json
  ) as imagens,
  coalesce(
    (
      select
        json_agg(
          to_jsonb(var.*) || jsonb_build_object(
            'imagens',
            coalesce(
              (
                select json_agg(img_v.*)
                from public.produto_imagens img_v
                where img_v.produto_id = var.id
              ),
              '[]'::json
            ),
            'categoria',
            (
              select to_jsonb(c_v.*)
              from public.produto_categorias c_v
              where c_v.id = var.categoria_id
            ),
            'termos_pesquisa',
            (
              select json_build_object('id', t_v.id, 'nome', t_v.nome)
              from public.produto_termo_de_pesquisa t_v
              where t_v.id = var.termo_pesquisa
            ),
            'termos_pesquisa_busca',
            (
              select t_v.nome
              from public.produto_termo_de_pesquisa t_v
              where t_v.id = var.termo_pesquisa
            )
          )
        )
      from public.produtos_workspace var
      where var.parent_id = p.id
    ),
    '[]'::json
  ) as variacoes
from public.produtos_workspace p
where p.parent_id is null;

comment on view public.view_produtos_com_variacoes is
  'Produtos pai com variações, imagens, categoria e termo de pesquisa (produtos_workspace.termo_pesquisa).';
