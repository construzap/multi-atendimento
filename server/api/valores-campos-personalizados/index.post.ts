import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { ValorCampoPersonalizadoSalvarResponse } from '#shared/types/camposPersonalizados'
import { mapValorRow, serializarValorCampo, tipoCampoFromRow } from '../../utils/camposPersonalizadosDb'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'
import { parsePositiveInt } from '../../utils/parsePositiveInt'

type Body = {
  workspace_id?: unknown
  conversa_key?: unknown
  campo_id?: unknown
  valor?: unknown
}

/**
 * POST /api/valores-campos-personalizados
 *
 * Body: `{ workspace_id, conversa_key, campo_id, valor }` — cria ou atualiza o valor
 * de um campo personalizado para a conversa (upsert por `conversa_key` + `campo_id`).
 */
export default defineEventHandler(async (event): Promise<ValorCampoPersonalizadoSalvarResponse> => {
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
  const conversaKey = String(body.conversa_key ?? '').trim()
  const campoId = parsePositiveInt(body.campo_id, 'campo_id')

  if (!conversaKey) {
    throw createError({ statusCode: 400, statusMessage: 'Informe conversa_key.' })
  }

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: conversa, error: convErr } = await admin
    .from('conversas')
    .select('key')
    .eq('key', conversaKey)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .maybeSingle()

  if (convErr) {
    throw createError({ statusCode: 500, statusMessage: convErr.message })
  }
  if (!conversa) {
    throw createError({ statusCode: 404, statusMessage: 'Conversa não encontrada neste workspace.' })
  }

  const { data: campo, error: campoErr } = await admin
    .from('campos_personalizados')
    .select('id, tipo')
    .eq('id', campoId)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .maybeSingle()

  if (campoErr) {
    throw createError({ statusCode: 500, statusMessage: campoErr.message })
  }
  if (!campo) {
    throw createError({ statusCode: 404, statusMessage: 'Campo personalizado não encontrado.' })
  }

  const tipo = tipoCampoFromRow((campo as { tipo?: unknown }).tipo)
  const valor = serializarValorCampo(tipo, body.valor)
  const now = new Date().toISOString()

  const { data, error } = await admin
    .from('valores_campos_personalizados')
    .upsert(
      {
        campo_id: campoId,
        conversa_key: conversaKey,
        valor,
        updated_at: now,
      },
      { onConflict: 'conversa_key,campo_id' },
    )
    .select('id, campo_id, conversa_key, valor, updated_at')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return { data: mapValorRow(data as Record<string, unknown>) }
})
