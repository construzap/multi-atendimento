import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError } from 'h3'
import type { Workspace } from '#shared/types/workspace'
import { checkAdmin } from '../../utils/checkAdmin'
import { getAuthUserId } from '../../utils/getAuthUserId'

/**
 * GET /api/admin/puxawokspaces
 * Lista todos os workspaces ativos (sem soft delete), apenas para administradores.
 */
export default defineEventHandler(async (event): Promise<Workspace[]> => {
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

  await checkAdmin(event, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data, error } = await admin
    .from('workspace')
    .select('id, nome, descricao, created_at')
    .is('deleted_at', null)
    .is('deleted_by', null)
    .order('created_at', { ascending: false })

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    })
  }

  return (data ?? []) as Workspace[]
})
