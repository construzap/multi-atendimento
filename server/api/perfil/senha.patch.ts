import { serverSupabaseClient } from '#supabase/server'
import { createError, readBody } from 'h3'
import { validarSenhaUsuario } from '#shared/utils/validarSenhaUsuario'
import { getAuthUserId } from '../../utils/getAuthUserId'

type AlterarSenhaBody = {
  new_password?: unknown
  new_password_confirm?: unknown
  revogar_outras_sessoes?: unknown
}

type AlterarSenhaResponse = {
  ok: true
  revogou_outras_sessoes: boolean
  aviso?: string
}

/**
 * PATCH /api/perfil/senha
 * Altera a senha do usuário autenticado via Supabase Auth (`auth.updateUser`).
 */
export default defineEventHandler(async (event): Promise<AlterarSenhaResponse> => {
  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Não autenticado',
    })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Não autenticado',
    })
  }

  const body = (await readBody<AlterarSenhaBody>(event)) ?? {}

  if (typeof body.new_password !== 'string' || typeof body.new_password_confirm !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Envie new_password e new_password_confirm',
    })
  }

  const novaSenha = body.new_password
  const confirmarSenha = body.new_password_confirm

  if (novaSenha !== confirmarSenha) {
    throw createError({
      statusCode: 400,
      statusMessage: 'As senhas não conferem.',
    })
  }

  const validacao = validarSenhaUsuario(novaSenha)
  if (!validacao.valida) {
    throw createError({
      statusCode: 400,
      statusMessage: validacao.mensagem ?? 'Senha inválida.',
    })
  }

  const { error: updateError } = await client.auth.updateUser({ password: novaSenha })

  if (updateError) {
    throw createError({
      statusCode: 400,
      statusMessage: updateError.message || 'Não foi possível alterar a senha.',
    })
  }

  const revogarOutras = body.revogar_outras_sessoes === true

  if (!revogarOutras) {
    return { ok: true, revogou_outras_sessoes: false }
  }

  const { error: signOutError } = await client.auth.signOut({ scope: 'others' })

  if (signOutError) {
    return {
      ok: true,
      revogou_outras_sessoes: false,
      aviso:
        'Senha alterada, mas não foi possível encerrar os acessos em outros dispositivos. Tente novamente mais tarde.',
    }
  }

  return { ok: true, revogou_outras_sessoes: true }
})
