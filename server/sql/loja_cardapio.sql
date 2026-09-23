-- Cardápio público da loja: 1 RPC devolve workspace + termos + produtos.
-- Rodar no SQL Editor do Supabase. NÃO executar automaticamente pelo app.
-- Chamada só via service_role (Nitro). Sem GRANT para anon/authenticated.

-- ---------------------------------------------------------------------------
-- Índices (loja)
-- ---------------------------------------------------------------------------

create index if not exists idx_produtos_loja_pai_ativo
  on public.produtos_workspace (workspace_id, id)
  where status = true and parent_id is null;

create extension if not exists pg_trgm;

create index if not exists idx_produtos_loja_nome_trgm
  on public.produtos_workspace using gin (nome gin_trgm_ops)
  where status = true and parent_id is null;

create index if not exists idx_produto_imagens_produto_ordem
  on public.produto_imagens (produto_id, ordem, id);

create index if not exists idx_vinculo_termo_ordem_produto
  on public.produto_termo_de_pesquisa_vinculo (termo_id, ordem, produto_id);

-- ---------------------------------------------------------------------------
-- RPC: public.loja_cardapio(p_workspace_id, p_offset)
-- O slug agora vive em canais.loja_slug; o Nitro resolve o canal e passa o id.
-- Retorna null se o workspace não existir / estiver apagado.
-- Produtos: pais ativos, foto principal, sem preco_custo.
-- Páginas de 200 linhas (produto × termo). p_offset = linhas já carregadas.
-- ---------------------------------------------------------------------------

drop function if exists public.loja_cardapio(text);
drop function if exists public.loja_cardapio(text, integer);
drop function if exists public.loja_cardapio(bigint, integer);

create or replace function public.loja_cardapio(p_workspace_id bigint, p_offset integer default 0)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_limit constant integer := 200;
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_ws_id bigint;
  v_ws_nome text;
  v_ws_logo text;
  v_total integer;
  v_payload jsonb;
begin
  select
    w.id,
    w.nome,
    nullif(trim(w.logo_url), '')
  into v_ws_id, v_ws_nome, v_ws_logo
  from public.workspace w
  where w.id = p_workspace_id
    and w.deleted_at is null
  limit 1;

  if v_ws_id is null then
    return null;
  end if;

  select count(*)::integer
  into v_total
  from public.produto_termo_de_pesquisa_vinculo v
  join public.produtos_workspace p on p.id = v.produto_id
  join public.produto_termo_de_pesquisa t on t.id = v.termo_id
  where t.workspace_id = v_ws_id
    and p.status = true
    and p.parent_id is null;

  with catalogo as (
    select
      p.id,
      v.termo_id,
      t.ordem as termo_ordem,
      v.ordem as ordem_no_termo,
      p.nome,
      p.descricao,
      p.preco,
      p.preco_promocional,
      coalesce(
        nullif(trim(p.imagem_url), ''),
        (
          select nullif(trim(i.imagem_url), '')
          from public.produto_imagens i
          where i.produto_id = p.id
          order by i.ordem, i.id
          limit 1
        )
      ) as imagem_url
    from public.produto_termo_de_pesquisa_vinculo v
    join public.produtos_workspace p on p.id = v.produto_id
    join public.produto_termo_de_pesquisa t on t.id = v.termo_id
    where t.workspace_id = v_ws_id
      and p.status = true
      and p.parent_id is null
    order by t.ordem, t.id, v.ordem, p.id
    offset v_offset
    limit v_limit
  )
  select jsonb_build_object(
    'workspace', jsonb_build_object(
      'id', v_ws_id,
      'nome', v_ws_nome,
      'logo_url', v_ws_logo
    ),
    'termos', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', t.id, 'nome', t.nome, 'ordem', t.ordem)
        order by t.ordem, t.id
      )
      from public.produto_termo_de_pesquisa t
      where t.workspace_id = v_ws_id
        and exists (select 1 from catalogo c where c.termo_id = t.id)
    ), '[]'::jsonb),
    'produtos', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'termo_id', c.termo_id,
          'ordem', c.ordem_no_termo,
          'nome', c.nome,
          'descricao', c.descricao,
          'preco', c.preco,
          'preco_promocional', c.preco_promocional,
          'imagem_url', c.imagem_url
        )
        order by c.termo_ordem, c.termo_id, c.ordem_no_termo, c.id
      )
      from catalogo c
    ), '[]'::jsonb),
    'total', v_total,
    'has_more', (v_offset + v_limit) < v_total
  )
  into v_payload;

  return v_payload;
end;
$$;

comment on function public.loja_cardapio(bigint, integer) is
  'Loja pública: workspace + termos + produtos (DTO mínimo, páginas de 200). Slug resolve em canais.';

revoke all on function public.loja_cardapio(bigint, integer) from public;
revoke all on function public.loja_cardapio(bigint, integer) from anon;
revoke all on function public.loja_cardapio(bigint, integer) from authenticated;
grant execute on function public.loja_cardapio(bigint, integer) to service_role;
