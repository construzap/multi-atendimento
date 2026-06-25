import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type { CamposPersonalizadosListaResponse } from '#shared/types/camposPersonalizados'
import { mapCampoRow } from '../../utils/camposPersonalizadosDb'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'
import { parsePositiveInt } from '../../utils/parsePositiveInt'

/**
 * GET /api/campos-personalizados?workspace_id=
 *
 * Lista campos personalizados ativos do workspace (sem soft delete).
 */
export default defineEventHandler(async (event): Promise<CamposPersonalizadosListaResponse> => {
  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const q = getQuery(event)
  const workspaceId = parsePositiveInt(q.workspace_id, 'workspace_id')
  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data, error } = await admin
    .from('campos_personalizados')
    .select('id, workspace_id, nome, tipo, created_at')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('nome', { ascending: true })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return {
    data: (data ?? []).map((r: Record<string, unknown>) => mapCampoRow(r)),
  }
})
