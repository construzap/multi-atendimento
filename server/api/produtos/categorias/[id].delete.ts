import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getQuery, getRouterParam } from 'h3'
import type { ProdutosCategoriaEliminarResponse } from '#shared/types/produtos'
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
 * DELETE /api/produtos/categorias/:id?workspace_id=
 *
 * Remove a categoria do workspace. Primeiro tira a referência dos produtos (`categoria_id` → null).
 */
export default defineEventHandler(async (event): Promise<ProdutosCategoriaEliminarResponse> => {
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
  const categoriaId = Number.parseInt(String(idParam ?? ''), 10)
  if (!Number.isFinite(categoriaId) || categoriaId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'id da categoria inválido.' })
  }

  const q = getQuery(event)
  const workspaceId = parsePositiveInt(q.workspace_id, 'workspace_id')

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: cat, error: catErr } = await admin
    .from('produto_categorias')
    .select('id')
    .eq('id', categoriaId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (catErr) {
    throw createError({ statusCode: 500, statusMessage: catErr.message })
  }
  if (!cat) {
    throw createError({ statusCode: 404, statusMessage: 'Categoria não encontrada neste workspace.' })
  }

  const { error: limpaErr } = await admin
    .from('produtos_workspace')
    .update({ categoria_id: null })
    .eq('workspace_id', workspaceId)
    .eq('categoria_id', categoriaId)

  if (limpaErr) {
    throw createError({ statusCode: 500, statusMessage: limpaErr.message })
  }

  const { error: delErr } = await admin
    .from('produto_categorias')
    .delete()
    .eq('id', categoriaId)
    .eq('workspace_id', workspaceId)

  if (delErr) {
    throw createError({ statusCode: 500, statusMessage: delErr.message })
  }

  return { ok: true }
})
