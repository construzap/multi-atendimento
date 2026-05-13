import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { FreteBairroWorkspace } from '#shared/types/frete'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'
import {
  mapBairroWorkspaceRow,
  parseFreteGratis,
  parseValorFreteBr,
  parseWorkspaceId,
} from '../../utils/freteBairroPayload'

type Body = {
  workspace_id?: unknown
  bairro?: unknown
  valor_frete?: unknown
  frete_gratis?: unknown
}

/**
 * POST /api/frete/bairro
 *
 * Body: `{ workspace_id, bairro, valor_frete?, frete_gratis? }`
 * — insere em `frete_bairro_workspace`. Com `frete_gratis: true`, `valor_frete` gravado como `null`.
 */
export default defineEventHandler(async (event): Promise<FreteBairroWorkspace> => {
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
  const workspaceId = parseWorkspaceId(body.workspace_id)
  const freteGratis = parseFreteGratis(body.frete_gratis)

  const bairroRaw = typeof body.bairro === 'string' ? body.bairro : String(body.bairro ?? '')
  const bairro = bairroRaw.trim()
  if (!bairro) {
    throw createError({ statusCode: 400, statusMessage: 'Informe o bairro.' })
  }
  if (bairro.length > 500) {
    throw createError({ statusCode: 400, statusMessage: 'Nome do bairro demasiado longo (máx. 500 caracteres).' })
  }

  let valorFrete: number | null
  if (freteGratis) {
    valorFrete = null
  } else {
    valorFrete = parseValorFreteBr(body.valor_frete, false)
  }

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const insertRow = {
    workspace_id: workspaceId,
    bairro,
    valor_frete: valorFrete,
    frete_gratis: freteGratis,
    ativo: true,
  }

  const { data, error } = await admin
    .from('frete_bairro_workspace')
    .insert(insertRow)
    .select('id, workspace_id, bairro, valor_frete, frete_gratis, ativo, created_at')
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  if (!data) {
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível cadastrar o frete por bairro.' })
  }

  return mapBairroWorkspaceRow(data as Record<string, unknown>)
})
