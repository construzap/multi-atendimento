-- View detalhada de termos de pesquisa (banco principal).
-- Sync vector store usa apenas linhas com em_uso = true.

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
