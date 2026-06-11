import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getQuery, getRouterParam } from 'h3'
import type { ProdutosTermoPesquisaEliminarResponse } from '#shared/types/produtos'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { getAuthUserId } from '../../../utils/getAuthUserId'

function parsePositiveInt(raw: unknown, label: string): number {
  const s = String(raw ?? '').trim()
  if (!s) {
    throw createError({ statusCode: 400, statusMessage: `${label} é obrigatório.` })
  }
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  if (String(n) !== s) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  return n
}

/**
 * DELETE /api/produtos/termos-de-pesquisa/:id?workspace_id=
 */
export default defineEventHandler(async (event): Promise<ProdutosTermoPesquisaEliminarResponse> => {
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
  const termoId = Number.parseInt(String(idParam ?? ''), 10)
  if (!Number.isFinite(termoId) || termoId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'id do termo inválido.' })
  }

  const q = getQuery(event)
  const workspaceId = parsePositiveInt(q.workspace_id, 'workspace_id')

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: termo, error: termoErr } = await admin
    .from('produto_termo_de_pesquisa')
    .select('id')
    .eq('id', termoId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (termoErr) {
    throw createError({ statusCode: 500, statusMessage: termoErr.message })
  }
  if (!termo) {
    throw createError({ statusCode: 404, statusMessage: 'Termo não encontrado neste workspace.' })
  }

  const { error: delVincErr } = await admin
    .from('produto_termo_de_pesquisa_vinculo')
    .delete()
    .eq('termo_id', termoId)

  if (delVincErr) {
    throw createError({ statusCode: 500, statusMessage: delVincErr.message })
  }

  const { error: delErr } = await admin
    .from('produto_termo_de_pesquisa')
    .delete()
    .eq('id', termoId)
    .eq('workspace_id', workspaceId)

  if (delErr) {
    throw createError({ statusCode: 500, statusMessage: delErr.message })
  }

  return { ok: true }
})
