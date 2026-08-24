-- Criptografa credenciais de pagamento e grava em public.canais.credenciais_encrypted
-- Usado por POST /api/canais/pagamento

create or replace function public.agente_set_canal_credenciais_pagarme(
  p_canal_id bigint,
  p_workspace_id bigint,
  p_credenciais text,
  p_passphrase text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_credenciais is null or length(trim(p_credenciais)) = 0 then
    raise exception 'credenciais vazias';
  end if;
  if p_passphrase is null or length(trim(p_passphrase)) = 0 then
    raise exception 'passphrase vazia';
  end if;

  update public.canais
  set credenciais_encrypted = extensions.pgp_sym_encrypt(trim(p_credenciais), p_passphrase)
  where id = p_canal_id
    and workspace_id = p_workspace_id
    and deleted_at is null;

  if not found then
    raise exception 'Canal não encontrado';
  end if;
end;
$$;

revoke all on function public.agente_set_canal_credenciais_pagarme(bigint, bigint, text, text) from public;
grant execute on function public.agente_set_canal_credenciais_pagarme(bigint, bigint, text, text) to service_role;
