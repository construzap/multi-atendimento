import { serverSupabaseServiceRole } from '#supabase/server'
import { createError } from 'h3'
import type { H3Event } from 'h3'

/** Mensagem quando o usuário logado não está em `atendentes` para aquele workspace. */
export const MSG_SEM_ACESSO_ATENDENTE =
  'Você não tem acesso a este workspace. Peça ao administrador para adicioná-lo como atendente.'

/**
 * Garante que o usuário logado pode atuar naquele workspace:
 * 1. Existe linha em `atendentes` com `workspace_id` e `atendente_user_id` = usuário logado.
 * 2. Com o `admin_user_id` dessa linha, confere em `workspace` que o dono (`user_id`) é esse admin
 *    e o workspace está ativo (sem soft delete).
 *
 * @throws {createError} 403 — sem vínculo em atendentes ou workspace inválido/removido.
 * @throws {createError} 500 — erro de banco.
 */
export async function checkWorkspace(
  event: H3Event,
  workspaceId: number,
  userId: string,
): Promise<void> {
  const admin = serverSupabaseServiceRole<any>(event)

  const { data: atendRow, error: atendErr } = await admin
    .from('atendentes')
    .select('admin_user_id')
    .eq('workspace_id', workspaceId)
    .eq('atendente_user_id', userId)
    .maybeSingle()

  if (atendErr) {
    throw createError({ statusCode: 500, statusMessage: atendErr.message })
  }

  if (!atendRow) {
    throw createError({
      statusCode: 403,
      statusMessage: MSG_SEM_ACESSO_ATENDENTE,
    })
  }

  const rawAdmin = (atendRow as { admin_user_id?: unknown }).admin_user_id
  const adminUserId =
    typeof rawAdmin === 'string'
      ? rawAdmin
      : rawAdmin != null
        ? String(rawAdmin)
        : ''

  if (!adminUserId) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Registro de atendente sem administrador associado.',
    })
  }

  const { data: wsRow, error: wsErr } = await admin
    .from('workspace')
    .select('id')
    .eq('id', workspaceId)
    .eq('user_id', adminUserId)
    .is('deleted_at', null)
    .is('deleted_by', null)
    .maybeSingle()

  if (wsErr) {
    throw createError({ statusCode: 500, statusMessage: wsErr.message })
  }

  if (!wsRow) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Workspace não encontrado ou foi removido.',
    })
  }
}
