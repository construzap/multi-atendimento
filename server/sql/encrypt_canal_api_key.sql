-- Criptografa api_key e grava em public.canais.api_key_encrypted
-- Usado por POST /api/canais/editarcanal

create or replace function public.agente_set_canal_api_key(
  p_canal_id bigint,
  p_workspace_id bigint,
  p_api_key text,
  p_passphrase text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_api_key is null or length(trim(p_api_key)) = 0 then
    raise exception 'api_key vazia';
  end if;
  if p_passphrase is null or length(trim(p_passphrase)) = 0 then
    raise exception 'passphrase vazia';
  end if;

  update public.canais
  set api_key_encrypted = extensions.pgp_sym_encrypt(trim(p_api_key), p_passphrase)
  where id = p_canal_id
    and workspace_id = p_workspace_id
    and deleted_at is null;

  if not found then
    raise exception 'Canal não encontrado';
  end if;
end;
$$;

revoke all on function public.agente_set_canal_api_key(bigint, bigint, text, text) from public;
grant execute on function public.agente_set_canal_api_key(bigint, bigint, text, text) to service_role;
