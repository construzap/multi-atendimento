import { serverSupabaseClient } from '#supabase/server'
import { assertMethod, createError } from 'h3'
import type { AdminGerenciarAssinaturasListaResponse } from '#shared/types/adminGerenciarAssinaturas'
import { checkAdmin } from '../../../utils/checkAdmin'
import { fetchTodosPerfisConsolidados } from '../../../utils/adminGerenciarAssinaturas'
import { getAuthUserId } from '../../../utils/getAuthUserId'

/**
 * GET /api/admin/gerenciarassinaturas
 * Lista todos os perfis de `vw_perfil_consolidado` (somente admin).
 */
export default defineEventHandler(async (event): Promise<AdminGerenciarAssinaturasListaResponse> => {
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

  const perfis = await fetchTodosPerfisConsolidados(event)
  return { perfis }
})
