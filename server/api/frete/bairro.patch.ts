import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { FreteBairroWorkspace } from '#shared/types/frete'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'
import {
  mapBairroWorkspaceRow,
  parseFreteGratis,
  parsePositiveRowId,
  parseValorFreteBr,
  parseWorkspaceId,
} from '../../utils/freteBairroPayload'

type Body = {
  id?: unknown
  workspace_id?: unknown
  bairro?: unknown
  valor_frete?: unknown
  frete_gratis?: unknown
}

/**
 * PATCH /api/frete/bairro
 *
 * Atualiza uma linha de `frete_bairro_workspace` do workspace.
 * Body: `{ id, workspace_id, bairro?, valor_frete?, frete_gratis? }`
 * — com `frete_gratis: true`, `valor_frete` é gravado como `null`.
 * Com `frete_gratis: false`, é obrigatório informar `valor_frete` (ou já existir valor na linha e enviar de novo).
 */
export default defineEventHandler(async (event): Promise<FreteBairroWorkspace> => {
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

  const body = (await readBody<Body>(event).catch(() => null)) ?? {}
  const rowId = parsePositiveRowId(body.id, 'id')
  const workspaceId = parseWorkspaceId(body.workspace_id)

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: existingRaw, error: fetchError } = await admin
    .from('frete_bairro_workspace')
    .select('id, workspace_id, bairro, valor_frete, frete_gratis, ativo, created_at')
    .eq('id', rowId)
    .eq('workspace_id', workspaceId)
    .eq('ativo', true)
    .maybeSingle()

  if (fetchError) {
    throw createError({ statusCode: 500, statusMessage: fetchError.message })
  }
  if (!existingRaw) {
    throw createError({ statusCode: 404, statusMessage: 'Frete por bairro não encontrado.' })
  }

  const existing = mapBairroWorkspaceRow(existingRaw as Record<string, unknown>)

  const freteGratis =
    body.frete_gratis !== undefined && body.frete_gratis !== null
      ? parseFreteGratis(body.frete_gratis)
      : existing.frete_gratis

  let bairro = existing.bairro
  if (body.bairro !== undefined && body.bairro !== null) {
    const bairroRaw = typeof body.bairro === 'string' ? body.bairro : String(body.bairro ?? '')
    bairro = bairroRaw.trim()
    if (!bairro) {
      throw createError({ statusCode: 400, statusMessage: 'Informe o bairro.' })
    }
    if (bairro.length > 500) {
      throw createError({ statusCode: 400, statusMessage: 'Nome do bairro demasiado longo (máx. 500 caracteres).' })
    }
  }

  let valorFrete: number | null
  if (freteGratis) {
    valorFrete = null
  } else if (body.valor_frete !== undefined && body.valor_frete !== null && String(body.valor_frete).trim() !== '') {
    valorFrete = parseValorFreteBr(body.valor_frete, false)
  } else if (existing.valor_frete != null) {
    valorFrete = existing.valor_frete
  } else {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe o valor do frete ou marque frete grátis.',
    })
  }

  const patch = {
    bairro,
    valor_frete: valorFrete,
    frete_gratis: freteGratis,
  }

  const { data, error } = await admin
    .from('frete_bairro_workspace')
    .update(patch)
    .eq('id', rowId)
    .eq('workspace_id', workspaceId)
    .select('id, workspace_id, bairro, valor_frete, frete_gratis, ativo, created_at')
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  if (!data) {
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível atualizar o frete por bairro.' })
  }

  return mapBairroWorkspaceRow(data as Record<string, unknown>)
})
