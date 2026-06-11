-- Recria a view de listagem incluindo termos de pesquisa (N:N) e texto auxiliar para busca.
-- Pré-requisitos: produto_termo_de_pesquisa, produto_termo_de_pesquisa_vinculo (ver produto_termo_de_pesquisa_vinculo.sql).
--
-- O tipo de `termos_pesquisa` muda de text → json; o Postgres não permite isso com CREATE OR REPLACE.

drop view if exists public.view_produtos_com_variacoes;

create view public.view_produtos_com_variacoes as
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
      select
        json_agg(
          json_build_object('id', t.id, 'nome', t.nome)
          order by t.nome
        )
      from public.produto_termo_de_pesquisa_vinculo v
      inner join public.produto_termo_de_pesquisa t on t.id = v.termo_id
      where v.produto_id = p.id
        and t.workspace_id = p.workspace_id
    ),
    '[]'::json
  ) as termos_pesquisa,
  (
    select string_agg(t.nome, ' ' order by t.nome)
    from public.produto_termo_de_pesquisa_vinculo v
    inner join public.produto_termo_de_pesquisa t on t.id = v.termo_id
    where v.produto_id = p.id
      and t.workspace_id = p.workspace_id
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
            coalesce(
              (
                select
                  json_agg(
                    json_build_object('id', t_v.id, 'nome', t_v.nome)
                    order by t_v.nome
                  )
                from public.produto_termo_de_pesquisa_vinculo v_v
                inner join public.produto_termo_de_pesquisa t_v on t_v.id = v_v.termo_id
                where v_v.produto_id = var.id
                  and t_v.workspace_id = var.workspace_id
              ),
              '[]'::json
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
  'Produtos pai com variações, imagens, categoria e termos de pesquisa (produto_termo_de_pesquisa_vinculo).';
