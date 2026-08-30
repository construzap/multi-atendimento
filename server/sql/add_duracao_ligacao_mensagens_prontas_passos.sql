-- Tempo em segundos que a ligação toca no passo tipo `ligacao`.
-- Não há conversa nem áudio; serve só para chamar a atenção do cliente.
ALTER TABLE public.mensagens_prontas_passos
  ADD COLUMN IF NOT EXISTS duracao_ligacao_segundos integer NULL;

COMMENT ON COLUMN public.mensagens_prontas_passos.duracao_ligacao_segundos IS
  'Segundos que a ligação toca (tipo ligacao). Sem conversa nem áudio; só chama a atenção do cliente.';

ALTER TABLE public.mensagens_prontas_passos
  DROP CONSTRAINT IF EXISTS mensagens_prontas_passos_duracao_ligacao_check;

ALTER TABLE public.mensagens_prontas_passos
  ADD CONSTRAINT mensagens_prontas_passos_duracao_ligacao_check
  CHECK (
    (
      tipo <> 'ligacao'
      AND duracao_ligacao_segundos IS NULL
    )
    OR (
      tipo = 'ligacao'
      AND duracao_ligacao_segundos IS NOT NULL
      AND duracao_ligacao_segundos >= 1
      AND duracao_ligacao_segundos <= 60
    )
  );
