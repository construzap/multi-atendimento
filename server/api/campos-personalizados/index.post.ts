import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { CampoPersonalizadoCriarResponse } from '#shared/types/camposPersonalizados'
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
 * POST /api/campos-personalizados
 *
 * Body: `{ workspace_id, nome, tipo? }` — cria um campo personalizado no workspace.
 */
export default defineEventHandler(async (event): Promise<CampoPersonalizadoCriarResponse> => {
  assertMethod(event, 'POST')

  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const body = (await readBody<Body>(event).catch(() => null)) ?? {}
  const workspaceId = parsePositiveInt(body.workspace_id, 'workspace_id')
  const nome = String(body.nome ?? '').trim()
  const tipo = parseTipoCampo(body.tipo ?? 'text')

  if (!nome) {
    throw createError({ statusCode: 400, statusMessage: 'Informe o nome do campo.' })
  }
  if (nome.length > 200) {
    throw createError({ statusCode: 400, statusMessage: 'Nome do campo demasiado longo (máx. 200 caracteres).' })
  }

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: inserted, error } = await admin
    .from('campos_personalizados')
    .insert({
      workspace_id: workspaceId,
      nome,
      tipo,
    })
    .select('id, workspace_id, nome, tipo, created_at')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return { data: mapCampoRow(inserted as Record<string, unknown>) }
})
