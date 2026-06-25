import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getQuery, getRouterParam } from 'h3'
import type { CampoPersonalizadoEliminarResponse } from '#shared/types/camposPersonalizados'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'
import { parsePositiveInt } from '../../utils/parsePositiveInt'

/**
 * DELETE /api/campos-personalizados/:id?workspace_id=
 *
 * Exclui permanentemente o campo personalizado e os valores associados.
 */
export default defineEventHandler(async (event): Promise<CampoPersonalizadoEliminarResponse> => {
  assertMethod(event, 'DELETE')

  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const idParam = getRouterParam(event, 'id')
  const campoId = Number.parseInt(String(idParam ?? ''), 10)
  if (!Number.isFinite(campoId) || campoId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'id do campo inválido.' })
  }

  const q = getQuery(event)
  const workspaceId = parsePositiveInt(q.workspace_id, 'workspace_id')

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: atual, error: selErr } = await admin
    .from('campos_personalizados')
    .select('id')
    .eq('id', campoId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (selErr) {
    throw createError({ statusCode: 500, statusMessage: selErr.message })
  }
  if (!atual) {
    throw createError({ statusCode: 404, statusMessage: 'Campo personalizado não encontrado.' })
  }

  const { error: valDelErr } = await admin
    .from('valores_campos_personalizados')
    .delete()
    .eq('campo_id', campoId)

  if (valDelErr) {
    throw createError({ statusCode: 500, statusMessage: valDelErr.message })
  }

  const { error: delErr } = await admin
    .from('campos_personalizados')
    .delete()
    .eq('id', campoId)
    .eq('workspace_id', workspaceId)

  if (delErr) {
    throw createError({ statusCode: 500, statusMessage: delErr.message })
  }

  return { ok: true }
})
