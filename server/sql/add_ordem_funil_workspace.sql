-- Adiciona coluna `ordem` em funil_workspace.
-- O funil com ordem = 1 é o funil padrão exibido no GET /api/kanban.
--
-- Execute no SQL Editor do Supabase (ou psql) uma vez.

BEGIN;

ALTER TABLE public.funil_workspace
  ADD COLUMN IF NOT EXISTS ordem smallint NOT NULL DEFAULT 1;

-- Backfill: 1º funil por workspace = ordem 1, demais = 2, 3… (por created_at)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY workspace_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.funil_workspace
)
UPDATE public.funil_workspace fw
SET ordem = ranked.rn::smallint
FROM ranked
WHERE fw.id = ranked.id;

CREATE INDEX IF NOT EXISTS idx_workspace_funis_workspace_id_ordem
  ON public.funil_workspace USING btree (workspace_id, ordem);

COMMIT;
