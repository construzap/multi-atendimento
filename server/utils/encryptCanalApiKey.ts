import { createError } from 'h3'

type SupabaseAdmin = ReturnType<
  typeof import('#supabase/server').serverSupabaseServiceRole<any>
>

/**
 * Grava `canais.api_key_encrypted` com
 * `extensions.pgp_sym_encrypt(api_key, NUXT_AGENTE_SENHA_MESTRA_ENCRIPITOGRAFIA_API_KEY)`.
 */
export async function setCanalApiKeyEncrypted(
  admin: SupabaseAdmin,
  params: {
    canalId: number
    workspaceId: number
    apiKeyPlain: string
    passphrase: string
  },
): Promise<void> {
  const { error } = await admin.rpc('agente_set_canal_api_key', {
    p_canal_id: params.canalId,
    p_workspace_id: params.workspaceId,
    p_api_key: params.apiKeyPlain,
    p_passphrase: params.passphrase,
  })

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage:
        error.message.includes('function') || error.message.includes('schema cache')
          ? 'Função agente_set_canal_api_key ausente. Execute server/sql/encrypt_canal_api_key.sql no Supabase.'
          : `Falha ao criptografar API key: ${error.message}`,
    })
  }
}
