-- view_kanban_conversas — chat, kanban e contatos (posição em conversas.coluna_id)
DROP VIEW IF EXISTS public.view_kanban_conversas;

CREATE VIEW public.view_kanban_conversas
WITH (security_invoker = on) AS
WITH
  m_agrupadas AS (
    SELECT
      mensagens.key_conversa,
      jsonb_agg(
        jsonb_build_object(
          'message_id', mensagens.message_id,
          'created_at', mensagens.created_at,
          'from_me', mensagens.from_me,
          'message', mensagens.message,
          'phone', mensagens.phone,
          'lid', mensagens.lid,
          'connected_phone', mensagens.connected_phone,
          'messagetype', mensagens.messagetype,
          'from_api', mensagens.from_api,
          'id_canal', mensagens.id_canal,
          'media_url', mensagens.media_url,
          'caption', mensagens.caption,
          'filename', mensagens.filename,
          'latitude', mensagens.latitude,
          'longitude', mensagens.longitude,
          'name', mensagens.name,
          'replyid', mensagens.replyid
        )
        ORDER BY mensagens.created_at
      ) AS historico_mensagens
    FROM public.mensagens
    WHERE mensagens.key_conversa IS NOT NULL
    GROUP BY mensagens.key_conversa
  ),
  c_personalizados AS (
    SELECT
      v.conversa_key,
      jsonb_agg(
        jsonb_build_object(
          'id', cp.id,
          'nome', cp.nome,
          'tipo', cp.tipo,
          'valor', v.valor
        )
        ORDER BY cp.nome
      ) AS lista_campos
    FROM public.valores_campos_personalizados v
    JOIN public.campos_personalizados cp ON cp.id = v.campo_id
    GROUP BY v.conversa_key
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
  COALESCE(m.historico_mensagens, '[]'::jsonb) AS mensagens,
  COALESCE(cp.lista_campos, '[]'::jsonb) AS campos_personalizados
FROM public.conversas c
LEFT JOIN public.funil_workspace fw ON fw.id = c.funil_id
LEFT JOIN public.funil_workspace_colunas fwc
  ON fwc.id = c.coluna_id
  AND fwc.funil_id = fw.id
  AND fwc.deleted_at IS NULL
LEFT JOIN public.canais ca ON ca.id = c.id_canal AND ca.deleted_at IS NULL
LEFT JOIN m_agrupadas m ON m.key_conversa = c.key
LEFT JOIN c_personalizados cp ON cp.conversa_key = c.key
WHERE c.deleted_at IS NULL;

GRANT SELECT ON public.view_kanban_conversas TO authenticated;
GRANT SELECT ON public.view_kanban_conversas TO service_role;
