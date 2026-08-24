import { createError } from 'h3'

type SupabaseAdmin = ReturnType<
  typeof import('#supabase/server').serverSupabaseServiceRole<any>
>

/**
 * Grava `canais.credenciais_encrypted` com
 * `extensions.pgp_sym_encrypt(..., NUXT_AGENTE_SENHA_MESTRA_ENCRIPTOGRAFIA_API_KEY)`.
 */
export async function setCanalCredenciaisPagarmeEncrypted(
  admin: SupabaseAdmin,
  params: {
    canalId: number
    workspaceId: number
    credenciaisPlain: string
    passphrase: string
  },
): Promise<void> {
  const { error } = await admin.rpc('agente_set_canal_credenciais_pagarme', {
    p_canal_id: params.canalId,
    p_workspace_id: params.workspaceId,
    p_credenciais: params.credenciaisPlain,
    p_passphrase: params.passphrase,
  })

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage:
        error.message.includes('function') || error.message.includes('schema cache')
          ? 'Função agente_set_canal_credenciais_pagarme ausente. Execute server/sql/encrypt_canal_credenciais_pagarme.sql no Supabase.'
          : `Falha ao criptografar credenciais: ${error.message}`,
    })
  }
}
