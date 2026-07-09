-- Migração: trocar constraint UNIQUE global em message_id
-- pela constraint composta UNIQUE(message_id, id_canal).
--
-- Problema resolvido:
--   O mesmo message_id do WhatsApp chega em dois canais diferentes (um como fromMe=true,
--   outro como fromMe=false). O upsert com onConflict:'message_id' global fazia o segundo
--   webhook sobrescrever a linha do primeiro, deixando a conversa do canal 1 sem mensagem.
--
-- Solução:
--   Cada par (message_id, id_canal) é único. A mesma mensagem pode existir em canais diferentes.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Dropar FK auto-referencial replyid → message_id (depende do índice da PK)
--    Essa FK não faz mais sentido com a nova chave composta.
--    O app já resolve replyid por código; a integridade pelo banco era bonus.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.mensagens
  DROP CONSTRAINT IF EXISTS fk_mensagens_replyid;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Dropar a PK global em message_id
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.mensagens
  DROP CONSTRAINT IF EXISTS mensagens_pkey;

-- Remove também qualquer unique isolado em message_id que possa existir
ALTER TABLE public.mensagens
  DROP CONSTRAINT IF EXISTS mensagens_message_id_key;

ALTER TABLE public.mensagens
  DROP CONSTRAINT IF EXISTS mensagens_message_id_unique;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Adicionar coluna id como surrogate PK (uuid gerado automaticamente)
--    Usamos ADD COLUMN IF NOT EXISTS para não quebrar se já existir.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.mensagens
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

-- Popular o id nas linhas que ainda não têm (caso a coluna já existisse sem default)
UPDATE public.mensagens SET id = gen_random_uuid() WHERE id IS NULL;

-- Garantir NOT NULL
ALTER TABLE public.mensagens
  ALTER COLUMN id SET NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Nova PK na coluna id
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.mensagens
  DROP CONSTRAINT IF EXISTS mensagens_id_pkey;

ALTER TABLE public.mensagens
  ADD CONSTRAINT mensagens_id_pkey PRIMARY KEY (id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Constraint UNIQUE composta: (message_id, id_canal)
--    Garante que o mesmo message_id WhatsApp pode existir em canais diferentes,
--    mas não pode ser duplicado dentro do mesmo canal.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.mensagens
  DROP CONSTRAINT IF EXISTS mensagens_message_id_id_canal_key;

ALTER TABLE public.mensagens
  ADD CONSTRAINT mensagens_message_id_id_canal_key
  UNIQUE (message_id, id_canal);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) Índices úteis
-- ─────────────────────────────────────────────────────────────────────────────

-- Busca por message_id isolado (lookups globais pontuais)
CREATE INDEX IF NOT EXISTS idx_mensagens_message_id
  ON public.mensagens (message_id);

-- Índice composto já existente (garante que continue existindo)
CREATE INDEX IF NOT EXISTS idx_mensagens_id_canal_message_id
  ON public.mensagens (id_canal, message_id);
