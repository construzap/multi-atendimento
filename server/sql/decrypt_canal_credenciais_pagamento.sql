-- Descriptografa canais.credenciais_encrypted (API key Asaas / Pagar.me).
-- Rodar no SQL Editor do Supabase. NÃO executar automaticamente pelo app.
-- Mesma senha mestra de agente_set_canal_credenciais_pagarme:
--   NUXT_AGENTE_SENHA_MESTRA_ENCRIPTOGRAFIA_API_KEY

create or replace function public.agente_canal_credenciais_pagamento(
  p_canal_id bigint,
  p_workspace_id bigint,
  p_passphrase text
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_cipher text;
  v_plain text;
begin
  if p_passphrase is null or length(trim(p_passphrase)) = 0 then
    raise exception 'passphrase vazia';
  end if;

  select credenciais_encrypted
    into v_cipher
    from public.canais
   where id = p_canal_id
     and workspace_id = p_workspace_id
     and deleted_at is null;

  if not found then
    raise exception 'Canal não encontrado';
  end if;

  if v_cipher is null or length(trim(v_cipher)) = 0 then
    return null;
  end if;

  v_plain := extensions.pgp_sym_decrypt(v_cipher::bytea, p_passphrase);
  return nullif(trim(v_plain), '');
end;
$$;

revoke all on function public.agente_canal_credenciais_pagamento(bigint, bigint, text) from public;
revoke all on function public.agente_canal_credenciais_pagamento(bigint, bigint, text) from anon;
revoke all on function public.agente_canal_credenciais_pagamento(bigint, bigint, text) from authenticated;
grant execute on function public.agente_canal_credenciais_pagamento(bigint, bigint, text) to service_role;
