-- Schema de referência (já aplicado no Supabase): entregadores + colunas de entrega em notificacoes_ia.
-- Mantido no repo para documentação / ambientes novos.

-- public.entregadores
--   id, workspace_id, codigo (unique com workspace), nome, ativo, created_at, updated_at

-- public.notificacoes_ia (colunas de entrega)
--   token_entrega uuid unique
--   codigo_confirmacao text (gerado pelo N8N; letras/números/especiais)
--   entrega_status text default 'aguardando_entregador'
--   entregador_id bigint FK entregadores
--   coletado_at, no_local_at, entregue_at timestamptz

SELECT 1;
