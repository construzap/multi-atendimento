-- view_kanban_conversas — chat, kanban e contatos (posição em conversas.coluna_id)
-- Inclui agregação de notificacoes_ia. Campos personalizados continuam nas tabelas.
DROP VIEW IF EXISTS public.view_kanban_conversas;

CREATE VIEW public.view_kanban_conversas
WITH (security_invoker = on) AS
WITH
  n_agrupadas AS (
    SELECT
      n_1.conversa_key,
      jsonb_agg(
        jsonb_build_object(
          'id', n_1.id,
          'produtos', n_1.produtos,
          'total_orcamento', n_1.total_orcamento,
          'observacoes', n_1.observacoes,
          'forma_pagamento', n_1.forma_pagamento,
          'latitude', n_1.latitude,
          'longitude', n_1.longitude,
          'tipo_solicitacao', n_1.tipo_solicitacao,
          'created_at', n_1.created_at,
          'updated_at', n_1.updated_at,
          'entrega_ou_retirada', n_1.entrega_ou_retirada,
          'concluido', COALESCE(n_1.concluido, false),
          'endereco', n_1.endereco
        )
        ORDER BY n_1.created_at DESC
      ) AS lista_notificacoes
    FROM public.notificacoes_ia n_1
    GROUP BY n_1.conversa_key
  )
SELECT
  c.key AS conversa_key,
  c.name,
  c.phone,
  c.photo,
  c.lid,
  c.message AS preview,
  c.messatype,
  c.created_at,
  c.connect_phone,
  c.from_me,
  c.media_url,
  c.id_group,
  c.updated_at,
  c.nao_lidas,
  c.name_group,
  c.id_canal,
  ca.nome AS canal_nome,
  c.conversa_aberta,
  c.is_group,
  c.ia_ligada,
  c.workspace_id,
  c.funil_id,
  c.coluna_id,
  c.atendente_id,
  NULL::integer AS posicao,
  NULL::smallint AS prioridade,
  COALESCE(n.lista_notificacoes, '[]'::jsonb) AS notificacoes_ia
FROM public.conversas c
LEFT JOIN public.funil_workspace fw ON fw.id = c.funil_id
LEFT JOIN public.funil_workspace_colunas fwc
  ON fwc.id = c.coluna_id
  AND fwc.funil_id = fw.id
  AND fwc.deleted_at IS NULL
LEFT JOIN public.canais ca ON ca.id = c.id_canal AND ca.deleted_at IS NULL
LEFT JOIN n_agrupadas n ON n.conversa_key = c.key
WHERE c.deleted_at IS NULL;

GRANT SELECT ON public.view_kanban_conversas TO authenticated;
GRANT SELECT ON public.view_kanban_conversas TO service_role;
