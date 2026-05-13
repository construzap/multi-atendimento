import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type { ProdutosBuscaResponse } from '#shared/types/produtos'
import { mapProdutoWorkspaceRow, SELECT_PRODUTO_WORKSPACE_EMBED } from '../../utils/produtoWorkspaceRow'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

const SELECT = SELECT_PRODUTO_WORKSPACE_EMBED

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

function parsePage(raw: unknown, fallback: number): number {
  if (raw === undefined || raw === null || raw === '') return fallback
  const n = Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return fallback
  return n
}

function parsePageSize(raw: unknown, fallback: number): number {
  const n = parsePage(raw, fallback)
  return Math.min(100, Math.max(1, n))
}

/** Escapa `%` e `_` para uso em padrões `ilike` do PostgREST. */
function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/**
 * GET /api/produtos/buscar?workspace_id=&page=&page_size=&q=
 *
 * Lista paginada de `produtos_workspace` para o workspace (após `checkWorkspace`).
 * Com `q` não vazio, filtra apenas por **nome** do produto (`ilike`, case-insensitive).
 * Tipos da resposta: `ProdutosBuscaResponse` em `#shared/types/produtos`.
 */
export default defineEventHandler(async (event): Promise<ProdutosBuscaResponse> => {
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

  const page = parsePage(q.page, 1)
  const page_size = parsePageSize(q.page_size, 20)
  const searchRaw = typeof q.q === 'string' ? q.q.trim() : ''

  const admin = serverSupabaseServiceRole<any>(event)

  let query = admin
    .from('produtos_workspace')
    .select(SELECT, { count: 'exact' })
    .eq('workspace_id', workspaceId)

  if (searchRaw.length > 0) {
    const esc = escapeIlike(searchRaw)
    const p = `%${esc}%`
    query = query.ilike('nome', p)
  }

  const from = (page - 1) * page_size
  const to = from + page_size - 1

  const { data, error, count } = await query
    .order('nome', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true })
    .range(from, to)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const total = typeof count === 'number' && Number.isFinite(count) ? count : 0
  const total_pages = total === 0 ? 1 : Math.ceil(total / page_size)

  const rows = (data ?? []).map((r: Record<string, unknown>) => mapProdutoWorkspaceRow(r))

  return {
    data: rows,
    total,
    page,
    page_size,
    total_pages,
  }
})
