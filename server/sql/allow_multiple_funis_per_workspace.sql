-- Permite múltiplos funis por workspace (remove UNIQUE em workspace_id).
-- A criação automática do funil padrão ao criar workspace continua via API
-- (POST /api/workspaces → insert em funil_workspace).
--
-- Execute no SQL Editor do Supabase (ou psql) uma vez.

BEGIN;

ALTER TABLE public.funil_workspace
  DROP CONSTRAINT IF EXISTS workspace_funis_workspace_id_key;

-- Índice não-único para consultas por workspace (já pode existir).
CREATE INDEX IF NOT EXISTS idx_workspace_funis_workspace_id
  ON public.funil_workspace USING btree (workspace_id);

COMMIT;
