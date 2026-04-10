import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type { Canal } from '#shared/types/canal'
import { getAuthUserId } from '../../utils/getAuthUserId'

/**
 * GET /api/canais?workspace_id=
 * Lista canais do workspace para o usuário logado (não deletados).
 */
export default defineEventHandler(async (event): Promise<Canal[]> => {
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

  const q = getQuery(event)
  const raw = q.workspace_id
  if (raw === undefined || raw === null || raw === '') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe workspace_id na query.'
    })
  }

  const workspaceId =
    typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)

  if (!Number.isFinite(workspaceId) || !Number.isInteger(workspaceId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'workspace_id inválido.'
    })
  }

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: wsRow, error: wsError } = await admin
    .from('workspace')
    .select('id')
    .eq('id', workspaceId)
    .eq('user_id', userId)
    .is('deleted_by', null)
    .is('deleted_at', null)
    .maybeSingle()

  if (wsError) {
    throw createError({
      statusCode: 500,
      statusMessage: wsError.message
    })
  }

  if (!wsRow) {
    throw createError({
      statusCode: 403,
      statusMessage:
        'Workspace não encontrado, não pertence ao seu usuário ou foi removido.'
    })
  }

  const { data, error } = await admin
    .from('canais')
    .select('id, nome, descricao, token, servidor, provedor, created_at')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .is('deleted_by', null)
    .order('created_at', { ascending: false })

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message
    })
  }

  return (data ?? []) as Canal[]
})
