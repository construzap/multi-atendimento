-- =============================================================================
-- Recria `public.conversas` + FKs + views + trigger
-- (após DROP TABLE conversas CASCADE)
--
-- Rode no SQL Editor do Supabase (projeto inteiro).
-- Dados de conversas são reconstruídos a partir de `mensagens` + `funil_conversa_status`.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Tabela conversas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversas (
  key text NOT NULL,
  message text NULL,
  messatype text NULL,
  name text NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL,
  id_canal bigint NULL,
  phone text NULL,
  lid text NULL,
  connect_phone text NULL,
  photo text NULL,
  from_me boolean NULL,
  media_url text NULL,
  deleted_at timestamp with time zone NULL,
  deleted_by uuid NULL,
  workspace_id bigint NULL,
  latitude double precision NULL,
  longitude double precision NULL,
  conversa_aberta boolean NULL,
  is_group boolean NULL DEFAULT false,
  id_group text NULL,
  name_group text NULL,
  ia_ligada boolean NULL DEFAULT true,
  nao_lidas integer NOT NULL DEFAULT 0,
  coluna_id bigint NULL,
  atendente_id bigint NULL,
  funil_id bigint NULL,
  CONSTRAINT conversas_pkey PRIMARY KEY (key),
  CONSTRAINT conversas_atendente_id_fkey
    FOREIGN KEY (atendente_id) REFERENCES public.atendentes (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT conversas_coluna_id_fkey
    FOREIGN KEY (coluna_id) REFERENCES public.funil_workspace_colunas (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT conversas_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES auth.users (id)
    ON DELETE SET NULL,
  CONSTRAINT conversas_funil_id_fkey
    FOREIGN KEY (funil_id) REFERENCES public.funil_workspace (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT conversas_id_canal_fkey
    FOREIGN KEY (id_canal) REFERENCES public.canais (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT conversas_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES public.workspace (id)
    ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_conversas_canal_phone
  ON public.conversas USING btree (id_canal, phone);

CREATE INDEX IF NOT EXISTS idx_conversas_canal_lid
  ON public.conversas USING btree (id_canal, lid);

CREATE INDEX IF NOT EXISTS idx_conversas_workspace_id
  ON public.conversas USING btree (workspace_id);

CREATE INDEX IF NOT EXISTS idx_conversas_coluna_id
  ON public.conversas USING btree (coluna_id);

CREATE INDEX IF NOT EXISTS idx_conversas_atendente_id
  ON public.conversas USING btree (atendente_id);

CREATE INDEX IF NOT EXISTS idx_conversas_funil_id
  ON public.conversas USING btree (funil_id);

CREATE INDEX IF NOT EXISTS idx_conversas_updated_at
  ON public.conversas USING btree (updated_at DESC NULLS LAST);

-- ---------------------------------------------------------------------------
-- 2) Reconstrói linhas a partir de mensagens (última msg por key_conversa)
-- ---------------------------------------------------------------------------
INSERT INTO public.conversas (
  key,
  message,
  messatype,
  name,
  created_at,
  updated_at,
  id_canal,
  phone,
  lid,
  connect_phone,
  photo,
  from_me,
  media_url,
  workspace_id,
  conversa_aberta,
  is_group,
  nao_lidas,
  ia_ligada
)
SELECT
  last.key_conversa,
  last.message,
  last.messagetype,
  last.name,
  first_created.created_at,
  last.created_at,
  last.id_canal,
  last.phone,
  last.lid,
  last.connected_phone,
  NULL::text AS photo,
  last.from_me,
  last.media_url,
  ca.workspace_id,
  true AS conversa_aberta,
  false AS is_group,
  0 AS nao_lidas,
  true AS ia_ligada
FROM (
  SELECT DISTINCT ON (m.key_conversa)
    m.key_conversa,
    m.message,
    m.messagetype,
    m.name,
    m.created_at,
    m.id_canal,
    m.phone,
    m.lid,
    m.connected_phone,
    m.from_me,
    m.media_url
  FROM public.mensagens m
  WHERE m.key_conversa IS NOT NULL
    AND btrim(m.key_conversa) <> ''
  ORDER BY m.key_conversa, m.created_at DESC NULLS LAST
) last
LEFT JOIN LATERAL (
  SELECT MIN(m2.created_at) AS created_at
  FROM public.mensagens m2
  WHERE m2.key_conversa = last.key_conversa
) first_created ON true
LEFT JOIN public.canais ca ON ca.id = last.id_canal
ON CONFLICT (key) DO NOTHING;

-- Garante keys que existem só em funil_conversa_status (sem mensagens)
INSERT INTO public.conversas (
  key,
  workspace_id,
  coluna_id,
  funil_id,
  conversa_aberta,
  is_group,
  nao_lidas,
  ia_ligada,
  created_at,
  updated_at
)
SELECT
  fcs.conversa_key,
  fcs.workspace_id,
  fcs.coluna_id,
  fw.id AS funil_id,
  true,
  false,
  0,
  true,
  fcs.created_at,
  fcs.updated_at
FROM public.funil_conversa_status fcs
LEFT JOIN public.funil_workspace fw
  ON fw.workspace_id = fcs.workspace_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.conversas c WHERE c.key = fcs.conversa_key
)
ON CONFLICT (key) DO NOTHING;

-- Espelha coluna/funil do status legado nas conversas reconstruídas
UPDATE public.conversas c
SET
  coluna_id = COALESCE(c.coluna_id, fcs.coluna_id),
  funil_id = COALESCE(
    c.funil_id,
    (SELECT fw.id FROM public.funil_workspace fw WHERE fw.workspace_id = fcs.workspace_id LIMIT 1)
  ),
  workspace_id = COALESCE(c.workspace_id, fcs.workspace_id),
  updated_at = COALESCE(c.updated_at, fcs.updated_at, now())
FROM public.funil_conversa_status fcs
WHERE fcs.conversa_key = c.key;

-- ---------------------------------------------------------------------------
-- 3) FKs dependentes (mensagens / funil / valores)
-- ---------------------------------------------------------------------------

-- mensagens.key_conversa → conversas.key
ALTER TABLE public.mensagens
  DROP CONSTRAINT IF EXISTS mensagens_key_conversa_fkey;

ALTER TABLE public.mensagens
  ADD CONSTRAINT mensagens_key_conversa_fkey
  FOREIGN KEY (key_conversa) REFERENCES public.conversas (key)
  ON UPDATE CASCADE
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mensagens_key_conversa
  ON public.mensagens USING btree (key_conversa);

CREATE INDEX IF NOT EXISTS idx_mensagens_id_canal_message_id
  ON public.mensagens USING btree (id_canal, message_id);

-- funil_conversa_status.conversa_key → conversas.key
ALTER TABLE public.funil_conversa_status
  DROP CONSTRAINT IF EXISTS conversa_funil_status_conversa_fkey;

ALTER TABLE public.funil_conversa_status
  DROP CONSTRAINT IF EXISTS funil_conversa_status_conversa_key_fkey;

ALTER TABLE public.funil_conversa_status
  ADD CONSTRAINT funil_conversa_status_conversa_key_fkey
  FOREIGN KEY (conversa_key) REFERENCES public.conversas (key)
  ON UPDATE CASCADE
  ON DELETE CASCADE;

-- valores_campos_personalizados.conversa_key → conversas.key
ALTER TABLE public.valores_campos_personalizados
  DROP CONSTRAINT IF EXISTS valores_campos_personalizados_conversa_key_fkey;

ALTER TABLE public.valores_campos_personalizados
  ADD CONSTRAINT valores_campos_personalizados_conversa_key_fkey
  FOREIGN KEY (conversa_key) REFERENCES public.conversas (key)
  ON UPDATE CASCADE
  ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_valores_campos_conversa
  ON public.valores_campos_personalizados USING btree (conversa_key);

-- ---------------------------------------------------------------------------
-- 4) Trigger: lead novo no kanban (funil_conversa_status)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_inserir_contato_no_kanban()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_funil_id BIGINT;
  v_coluna_inicial_id BIGINT;
BEGIN
  IF NEW.workspace_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_funil_id
  FROM public.funil_workspace
  WHERE workspace_id = NEW.workspace_id
  LIMIT 1;

  IF v_funil_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_coluna_inicial_id
  FROM public.funil_workspace_colunas
  WHERE funil_id = v_funil_id
    AND ordem = 1
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_coluna_inicial_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.funil_conversa_status (
    conversa_key,
    workspace_id,
    coluna_id,
    updated_at
  )
  VALUES (
    NEW.key,
    NEW.workspace_id,
    v_coluna_inicial_id,
    NOW()
  )
  ON CONFLICT (conversa_key) DO NOTHING;

  -- Espelha em conversas (fonte usada pelo webhook / views)
  IF NEW.coluna_id IS NULL OR NEW.funil_id IS NULL THEN
    UPDATE public.conversas
    SET
      coluna_id = COALESCE(coluna_id, v_coluna_inicial_id),
      funil_id = COALESCE(funil_id, v_funil_id)
    WHERE key = NEW.key;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_inserir_contato_kanban_after_insert ON public.conversas;

CREATE TRIGGER tr_inserir_contato_kanban_after_insert
AFTER INSERT ON public.conversas
FOR EACH ROW
EXECUTE FUNCTION public.fn_inserir_contato_no_kanban();

-- ---------------------------------------------------------------------------
-- 5) View: listagem chat + webhook lookup
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.view_kanban_conversas;

CREATE VIEW public.view_kanban_conversas AS
WITH m_agrupadas AS (
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
  fcs.posicao,
  fcs.prioridade,
  COALESCE(m.historico_mensagens, '[]'::jsonb) AS mensagens
FROM public.conversas c
LEFT JOIN public.funil_workspace fw
  ON fw.id = c.funil_id
LEFT JOIN public.funil_workspace_colunas fwc
  ON fwc.id = c.coluna_id
  AND fwc.funil_id = fw.id
  AND fwc.deleted_at IS NULL
LEFT JOIN public.funil_conversa_status fcs
  ON fcs.conversa_key = c.key
LEFT JOIN public.canais ca
  ON ca.id = c.id_canal
  AND ca.deleted_at IS NULL
LEFT JOIN m_agrupadas m
  ON m.key_conversa = c.key
WHERE c.deleted_at IS NULL;

GRANT SELECT ON public.view_kanban_conversas TO authenticated;
GRANT SELECT ON public.view_kanban_conversas TO service_role;

-- ---------------------------------------------------------------------------
-- 6) View: kanban / contatos (status_funil + campos personalizados)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.view_conversas_com_detalhes_campos;

CREATE VIEW public.view_conversas_com_detalhes_campos AS
SELECT
  c.key,
  c.name,
  c.created_at,
  c.updated_at,
  c.id_canal,
  c.phone,
  c.lid,
  c.connect_phone,
  c.photo,
  c.message,
  c.messatype,
  c.from_me,
  c.media_url,
  c.workspace_id,
  c.latitude,
  c.longitude,
  c.conversa_aberta,
  c.is_group,
  c.id_group,
  c.name_group,
  c.ia_ligada,
  c.nao_lidas,
  c.deleted_at,
  c.deleted_by,
  c.coluna_id,
  c.funil_id,
  c.atendente_id,
  CASE
    WHEN COALESCE(c.coluna_id, fcs.coluna_id) IS NOT NULL THEN
      jsonb_strip_nulls(
        jsonb_build_object(
          'coluna_id', COALESCE(c.coluna_id, fcs.coluna_id),
          'funil_id', COALESCE(c.funil_id, fw_from_status.id, fw_from_conv.id),
          'coluna_nome', COALESCE(fwc_conv.nome, fwc_status.nome),
          'coluna_cor', COALESCE(fwc_conv.cor, fwc_status.cor),
          'atendente_id', COALESCE(c.atendente_id::text, fcs.atendente_id::text),
          'prioridade', fcs.prioridade,
          'posicao', fcs.posicao
        )
      )
    ELSE NULL
  END AS status_funil,
  COALESCE(cp.campos_personalizados, '[]'::jsonb) AS campos_personalizados
FROM public.conversas c
LEFT JOIN public.funil_conversa_status fcs
  ON fcs.conversa_key = c.key
LEFT JOIN public.funil_workspace fw_from_conv
  ON fw_from_conv.id = c.funil_id
LEFT JOIN public.funil_workspace fw_from_status
  ON fw_from_status.workspace_id = fcs.workspace_id
LEFT JOIN public.funil_workspace_colunas fwc_conv
  ON fwc_conv.id = c.coluna_id
  AND fwc_conv.deleted_at IS NULL
LEFT JOIN public.funil_workspace_colunas fwc_status
  ON fwc_status.id = fcs.coluna_id
  AND fwc_status.deleted_at IS NULL
LEFT JOIN LATERAL (
  SELECT
    jsonb_agg(
      jsonb_build_object(
        'id', cp.id,
        'nome', cp.nome,
        'tipo', cp.tipo,
        'valor', v.valor
      )
      ORDER BY cp.nome
    ) AS campos_personalizados
  FROM public.valores_campos_personalizados v
  JOIN public.campos_personalizados cp
    ON cp.id = v.campo_id
  WHERE v.conversa_key = c.key
) cp ON true;

GRANT SELECT ON public.view_conversas_com_detalhes_campos TO authenticated;
GRANT SELECT ON public.view_conversas_com_detalhes_campos TO service_role;
