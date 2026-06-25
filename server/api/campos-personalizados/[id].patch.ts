import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getRouterParam, readBody } from 'h3'
import type { CampoPersonalizadoAtualizarResponse } from '#shared/types/camposPersonalizados'
import { mapCampoRow, parseTipoCampo } from '../../utils/camposPersonalizadosDb'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'
import { parsePositiveInt } from '../../utils/parsePositiveInt'

type Body = {
  workspace_id?: unknown
  nome?: unknown
  tipo?: unknown
}

/**
 * PATCH /api/campos-personalizados/:id
 *
 * Body: `{ workspace_id, nome?, tipo? }` — atualiza nome e/ou tipo do campo.
 */
export default defineEventHandler(async (event): Promise<CampoPersonalizadoAtualizarResponse> => {
  assertMethod(event, 'PATCH')

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

  const body = (await readBody<Body>(event).catch(() => null)) ?? {}
  const workspaceId = parsePositiveInt(body.workspace_id, 'workspace_id')

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: atual, error: selErr } = await admin
    .from('campos_personalizados')
    .select('id, workspace_id, nome, tipo, created_at')
    .eq('id', campoId)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .maybeSingle()

  if (selErr) {
    throw createError({ statusCode: 500, statusMessage: selErr.message })
  }
  if (!atual) {
    throw createError({ statusCode: 404, statusMessage: 'Campo personalizado não encontrado.' })
  }

  const patch: Record<string, unknown> = {}

  if (body.nome !== undefined) {
    const nome = String(body.nome ?? '').trim()
    if (!nome) {
      throw createError({ statusCode: 400, statusMessage: 'Informe o nome do campo.' })
    }
    if (nome.length > 200) {
      throw createError({ statusCode: 400, statusMessage: 'Nome do campo demasiado longo (máx. 200 caracteres).' })
    }
    patch.nome = nome
  }

  if (body.tipo !== undefined) {
    patch.tipo = parseTipoCampo(body.tipo)
  }

  if (Object.keys(patch).length === 0) {
    return { data: mapCampoRow(atual as Record<string, unknown>) }
  }

  const { data: updated, error: upErr } = await admin
    .from('campos_personalizados')
    .update(patch)
    .eq('id', campoId)
    .eq('workspace_id', workspaceId)
    .select('id, workspace_id, nome, tipo, created_at')
    .single()

  if (upErr) {
    throw createError({ statusCode: 500, statusMessage: upErr.message })
  }

  return { data: mapCampoRow(updated as Record<string, unknown>) }
})
