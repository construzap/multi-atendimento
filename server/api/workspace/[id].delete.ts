import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError } from 'h3'

/**
 * DELETE /api/workspace/:id
 * Soft delete: preenche `deleted_at` e `deleted_by` (usuário logado).
 * Filtra por `id` e `user_id` e apenas se ainda não estiver deletado (`deleted_by IS NULL`).
 */
export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Não autenticado'
    })
  }

  const userId = authData.user.id
  const idParam = event.context.params?.id
  const workspaceId = Number(idParam)

  if (!Number.isFinite(workspaceId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID do workspace inválido.'
    })
  }

  const admin = serverSupabaseServiceRole<any>(event)
  const now = new Date().toISOString()

  const { data, error } = await admin
    .from('workspace')
    .update({
      deleted_at: now,
      deleted_by: userId
    })
    .eq('id', workspaceId)
    .eq('user_id', userId)
    .is('deleted_by', null)
    .select('id')
    .maybeSingle()

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message
    })
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Workspace não encontrado ou já removido.'
    })
  }

  return { ok: true as const, id: data.id as number }
})
