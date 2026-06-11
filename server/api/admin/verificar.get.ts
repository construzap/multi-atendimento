import { serverSupabaseClient } from '#supabase/server'
import { createError } from 'h3'
import type { AdminVerificarResponse } from '#shared/types/profile'
import { getAuthUserId } from '../../utils/getAuthUserId'
import { isUserAdmin } from '../../utils/checkAdmin'

/**
 * GET /api/admin/verificar
 * Confere se o usuário logado tem `profiles.role = 'ADMIN'`.
 */
export default defineEventHandler(async (event): Promise<AdminVerificarResponse> => {
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

  const isAdmin = await isUserAdmin(event, userId)

  return { isAdmin }
})
