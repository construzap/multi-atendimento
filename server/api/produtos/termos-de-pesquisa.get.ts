import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type { ProdutosTermosPesquisaListaResponse } from '#shared/types/produtos'
import { mapTermoPesquisaRow } from '../../utils/produtoTermosPesquisa'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

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

function parseLimit(raw: unknown, comFiltroNome: boolean): number {
  const max = comFiltroNome ? 50 : 2000
  const def = comFiltroNome ? 30 : 1000
  const n = Number.parseInt(String(raw ?? def), 10)
  if (!Number.isFinite(n) || n < 1) return def
  return Math.min(max, Math.max(1, n))
}

function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/**
 * GET /api/produtos/termos-de-pesquisa?workspace_id=&q=&limit=
 */
export default defineEventHandler(async (event): Promise<ProdutosTermosPesquisaListaResponse> => {
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

  const searchRaw = typeof q.q === 'string' ? q.q.trim() : ''
  const limit = parseLimit(q.limit, searchRaw.length > 0)

  const admin = serverSupabaseServiceRole<any>(event)

  let query = admin
    .from('produto_termo_de_pesquisa')
    .select('id, nome')
    .eq('workspace_id', workspaceId)
    .order('nome', { ascending: true })
    .limit(limit)

  if (searchRaw.length > 0) {
    const esc = escapeIlike(searchRaw)
    query = query.ilike('nome', `%${esc}%`)
  }

  const { data, error } = await query

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const rows = (data ?? []).map((r: Record<string, unknown>) => mapTermoPesquisaRow(r))

  return { data: rows }
})
