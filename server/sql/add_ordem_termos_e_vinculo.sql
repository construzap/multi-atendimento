-- Ordem manual: termos no workspace + produtos dentro de cada termo.
-- Rodar no SQL Editor do Supabase (projeto principal).

-- 1) Termos de pesquisa
alter table public.produto_termo_de_pesquisa
  add column if not exists ordem integer not null default 0;

-- Backfill: ordem atual = posição alfabética por workspace
with ranked as (
  select
    id,
    (row_number() over (
      partition by workspace_id
      order by lower(trim(nome)), id
    ) - 1)::integer as nova_ordem
  from public.produto_termo_de_pesquisa
)
update public.produto_termo_de_pesquisa t
set ordem = ranked.nova_ordem
from ranked
where t.id = ranked.id;

create index if not exists produto_termo_de_pesquisa_workspace_ordem_idx
  on public.produto_termo_de_pesquisa using btree (workspace_id, ordem);

comment on column public.produto_termo_de_pesquisa.ordem is
  'Posição do termo na lista do workspace (0 = primeiro).';

-- 2) Vínculo produto ↔ termo (ordem do produto dentro do termo)
alter table public.produto_termo_de_pesquisa_vinculo
  add column if not exists ordem integer not null default 0;

with ranked as (
  select
    produto_id,
    termo_id,
    (row_number() over (
      partition by termo_id
      order by produto_id
    ) - 1)::integer as nova_ordem
  from public.produto_termo_de_pesquisa_vinculo
)
update public.produto_termo_de_pesquisa_vinculo v
set ordem = ranked.nova_ordem
from ranked
where v.produto_id = ranked.produto_id
  and v.termo_id = ranked.termo_id;

create index if not exists produto_termo_de_pesquisa_vinculo_termo_ordem_idx
  on public.produto_termo_de_pesquisa_vinculo using btree (termo_id, ordem);

comment on column public.produto_termo_de_pesquisa_vinculo.ordem is
  'Posição do produto dentro do termo (0 = primeiro).';

-- 3) View detalhada: expõe ordem + produtos ordenados pelo vínculo
-- (precisa DROP: CREATE OR REPLACE não troca a ordem das colunas)
drop view if exists public.view_termos_pesquisa_detalhada;

create view public.view_termos_pesquisa_detalhada
with (security_invoker = on) as
select
  t.id,
  t.nome,
  t.workspace_id,
  t.ordem,
  count(v.produto_id) filter (where p.status = true) as total_usos,
  coalesce(
    json_agg(
      json_build_object('id', p.id, 'nome', p.nome)
      order by v.ordem, p.id
    ) filter (
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
group by t.id, t.nome, t.workspace_id, t.ordem;

comment on view public.view_termos_pesquisa_detalhada is
  'Termos com ordem, total_usos, produtos ativos (ordenados) e flag em_uso.';

-- 4) View de produtos: termos agregados por ordem do termo
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
  p.envia_foto,
  p.created_at,
  p.updated_at,
  p.codigo,
  p.categoria_id,
  p.descricao,
  p.codigo_ncm,
  coalesce(
    (
      select json_agg(
        json_build_object('id', t.id, 'nome', t.nome, 'ordem', t.ordem)
        order by t.ordem, t.id
      )
      from public.produto_termo_de_pesquisa_vinculo v
      join public.produto_termo_de_pesquisa t on t.id = v.termo_id
      where v.produto_id = p.id
    ),
    '[]'::json
  ) as termos_pesquisa,
  (
    select string_agg(t.nome, ' ' order by t.ordem, t.id)
    from public.produto_termo_de_pesquisa_vinculo v
    join public.produto_termo_de_pesquisa t on t.id = v.termo_id
    where v.produto_id = p.id
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
      select json_agg(img.* order by img.ordem, img.id)
      from public.produto_imagens img
      where img.produto_id = p.id
    ),
    '[]'::json
  ) as imagens,
  coalesce(
    (
      select json_agg(
        to_jsonb(var.*) || jsonb_build_object(
          'imagens',
          coalesce(
            (
              select json_agg(img_v.* order by img_v.ordem, img_v.id)
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
              select json_agg(
                json_build_object('id', t_v.id, 'nome', t_v.nome, 'ordem', t_v.ordem)
                order by t_v.ordem, t_v.id
              )
              from public.produto_termo_de_pesquisa_vinculo v_v
              join public.produto_termo_de_pesquisa t_v on t_v.id = v_v.termo_id
              where v_v.produto_id = var.id
            ),
            '[]'::json
          ),
          'termos_pesquisa_busca',
          (
            select string_agg(t_v.nome, ' ' order by t_v.ordem, t_v.id)
            from public.produto_termo_de_pesquisa_vinculo v_v
            join public.produto_termo_de_pesquisa t_v on t_v.id = v_v.termo_id
            where v_v.produto_id = var.id
          )
        )
        order by var.id
      )
      from public.produtos_workspace var
      where var.parent_id = p.id
    ),
    '[]'::json
  ) as variacoes
from public.produtos_workspace p
where p.parent_id is null;

comment on view public.view_produtos_com_variacoes is
  'Produtos pai com variações, imagens, categoria e termos (ordenados).';
