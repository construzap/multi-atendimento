import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError } from 'h3'
import type { Workspace } from '#shared/types/workspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

/**
 * GET /api/workspaces
 * Lista workspaces do usuário logado.
 *
 * - Filtra por `user_id` (UUID do auth)
 * - Filtra por `deleted_by IS NULL` (não deletados)
 * - Consulta via service role (tabela com RLS)
 */
export default defineEventHandler(async (event): Promise<Workspace[]> => {
  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Não autenticado'
    })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Não autenticado'
    })
  }

  // Tipos do DB ainda não configurados (Database = unknown), então usamos any aqui.
  const admin = serverSupabaseServiceRole<any>(event)
  const { data, error } = await admin
    .from('workspace')
    .select('id, nome, descricao, created_at')
    .eq('user_id', userId)
    .is('deleted_by', null)
    .order('created_at', { ascending: false })

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message
    })
  }

  return (data ?? []) as Workspace[]
})

