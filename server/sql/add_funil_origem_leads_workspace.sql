-- Funil usado junto com coluna_origem_leads para entrada de leads.
ALTER TABLE public.workspace
  ADD COLUMN IF NOT EXISTS funil_origem_leads bigint NULL;

COMMENT ON COLUMN public.workspace.funil_origem_leads IS
  'Funil (funil_workspace.id) usado junto com coluna_origem_leads para entrada de leads.';
