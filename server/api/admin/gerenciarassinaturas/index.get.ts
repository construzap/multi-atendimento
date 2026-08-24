import { serverSupabaseClient } from '#supabase/server'
import { assertMethod, createError, getQuery } from 'h3'
import type { AdminGerenciarAssinaturasResponse } from '#shared/types/adminGerenciarAssinaturas'
import { checkAdmin } from '../../../utils/checkAdmin'
import {
  fetchPerfilConsolidadoPorUserId,
  parseUserId,
} from '../../../utils/adminGerenciarAssinaturas'
import { getAuthUserId } from '../../../utils/getAuthUserId'

/**
 * GET /api/admin/gerenciarassinaturas?user_id=
 * Perfil consolidado do dono do workspace (`vw_perfil_consolidado`), somente admin.
 */
export default defineEventHandler(async (event): Promise<AdminGerenciarAssinaturasResponse> => {
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

  const perfil = await fetchPerfilConsolidadoPorUserId(event, userId)
  return { perfil }
})
