import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getQuery } from 'h3'
import type { AdminWorkspacesDoPerfilResponse } from '#shared/types/adminGerenciarAssinaturas'
import { checkAdmin } from '../../../utils/checkAdmin'
import { parseUserId } from '../../../utils/adminGerenciarAssinaturas'
import { getAuthUserId } from '../../../utils/getAuthUserId'

/**
 * GET /api/admin/gerenciarassinaturas/workspaces?user_id=
 * Lista nomes dos workspaces ativos do perfil (somente admin).
 */
export default defineEventHandler(async (event): Promise<AdminWorkspacesDoPerfilResponse> => {
  assertMethod(event, 'GET')

  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const authUserId = getAuthUserId(authData.user)
  if (!authUserId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  await checkAdmin(event, authUserId)

  const query = getQuery(event)
  const userId = parseUserId(query.user_id)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data, error } = await admin
    .from('workspace')
    .select('id, nome')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('nome', { ascending: true })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const workspaces = ((data ?? []) as Array<{ id?: unknown; nome?: unknown }>).map((row) => ({
    id: Number(row.id),
    nome: String(row.nome ?? ''),
  }))

  return { workspaces }
})
