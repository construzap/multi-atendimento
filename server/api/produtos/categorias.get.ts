import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type { ProdutoCategoriaItem, ProdutosCategoriasListaResponse } from '#shared/types/produtos'
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

/** Com filtro `q`: até 50. Sem `q` (lista completa do workspace): até 2000. */
function parseLimit(raw: unknown, comFiltroNome: boolean): number {
  const max = comFiltroNome ? 50 : 2000
  const def = comFiltroNome ? 30 : 1000
  const n = Number.parseInt(String(raw ?? def), 10)
  if (!Number.isFinite(n) || n < 1) return def
  return Math.min(max, Math.max(1, n))
}

/** Escapa `%` e `_` para uso em padrões `ilike` do PostgREST. */
function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function mapCategoriaRow(r: Record<string, unknown>): ProdutoCategoriaItem {
  const id = typeof r.id === 'number' ? r.id : Number(r.id)
  const nomeRaw = String(r.nome ?? '').trim()
  return {
    id: Number.isFinite(id) ? id : 0,
    nome: nomeRaw.length ? nomeRaw.toLocaleUpperCase('pt-BR') : '',
    ativo: Boolean(r.ativo),
  }
}

/**
 * GET /api/produtos/categorias?workspace_id=&q=&limit=
 *
 * Lista categorias ativas do workspace. Sem `q`, devolve todas (até `limit`, máx. 2000),
 * ordenadas por nome. Com `q`, filtra por `nome` (ilike), `limit` máx. 50.
 */
export default defineEventHandler(async (event): Promise<ProdutosCategoriasListaResponse> => {
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
    .from('produto_categorias')
    .select('id, nome, ativo')
    .eq('workspace_id', workspaceId)
    .eq('ativo', true)
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

  const rows = (data ?? []).map((r: Record<string, unknown>) => mapCategoriaRow(r))

  return { data: rows }
})
