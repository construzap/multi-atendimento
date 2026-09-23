import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type { ProdutosBuscaResponse } from '#shared/types/produtos'
import {
  mapViewProdutoComVariacoesRow,
  SELECT_VIEW_PRODUTOS_COM_VARIACOES,
} from '../../utils/produtoWorkspaceRow'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

const SELECT = SELECT_VIEW_PRODUTOS_COM_VARIACOES

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
  return Math.min(1000, Math.max(1, n))
}

/** Escapa `%` e `_` para uso em padrões `ilike` do PostgREST. */
function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/**
 * Aspas no valor de filtro PostgREST.
 * Em `.or()`, vírgulas no texto (ex.: `3,6L`) são interpretadas como separador de condições.
 */
function quotePostgrestFilterValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function sortByIdOrder<T extends { id: number }>(rows: T[], orderedIds: number[]): T[] {
  const rank = new Map(orderedIds.map((id, i) => [id, i]))
  return [...rows].sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9))
}

/**
 * GET /api/produtos/buscar?workspace_id=&page=&page_size=&q=&termo_id=
 *
 * Lista paginada de produtos pai via `view_produtos_com_variacoes` (após `checkWorkspace`).
 * Com `q` não vazio, filtra por **nome** ou **termos de pesquisa** (`termos_pesquisa_busca`, ilike).
 * Com `termo_id`, restringe aos produtos em `produto_termo_de_pesquisa_vinculo` e ordena por `vinculo.ordem`.
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
  const page_size = parsePageSize(q.page_size, 10)
  const searchRaw = typeof q.q === 'string' ? q.q.trim() : ''

  let termoId: number | null = null
  if (q.termo_id !== undefined && q.termo_id !== null && String(q.termo_id).trim() !== '') {
    termoId = parsePositiveInt(q.termo_id, 'termo_id')
  }

  const admin = serverSupabaseServiceRole<any>(event)

  /** IDs já na ordem do vínculo (quando há termo). */
  let orderedIdsPorTermo: number[] | null = null
  const ordemPorProduto = new Map<number, number>()
  if (termoId != null) {
    const { data: termoRow, error: termoErr } = await admin
      .from('produto_termo_de_pesquisa')
      .select('id')
      .eq('id', termoId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (termoErr) {
      throw createError({ statusCode: 500, statusMessage: termoErr.message })
    }
    if (!termoRow) {
      throw createError({ statusCode: 404, statusMessage: 'Termo de pesquisa não encontrado neste workspace.' })
    }

    const { data: vinculos, error: vinculoErr } = await admin
      .from('produto_termo_de_pesquisa_vinculo')
      .select('produto_id, ordem')
      .eq('termo_id', termoId)
      .order('ordem', { ascending: true })
      .order('produto_id', { ascending: true })

    if (vinculoErr) {
      throw createError({ statusCode: 500, statusMessage: vinculoErr.message })
    }

    orderedIdsPorTermo = []
    const seen = new Set<number>()
    for (const r of vinculos ?? []) {
      const id =
        typeof r.produto_id === 'number' ? r.produto_id : Number(r.produto_id)
      const ord =
        typeof r.ordem === 'number' ? r.ordem : Number.parseInt(String(r.ordem ?? '0'), 10)
      if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue
      seen.add(id)
      orderedIdsPorTermo.push(id)
      ordemPorProduto.set(id, Number.isFinite(ord) ? ord : orderedIdsPorTermo.length - 1)
    }

    if (orderedIdsPorTermo.length === 0) {
      return {
        data: [],
        total: 0,
        page,
        page_size,
        total_pages: 1,
      }
    }
  }

  function comOrdemNoTermo(
    rows: ReturnType<typeof mapViewProdutoComVariacoesRow>[],
  ): ReturnType<typeof mapViewProdutoComVariacoesRow>[] {
    if (!ordemPorProduto.size) return rows
    return rows.map((row) => ({
      ...row,
      ordem_no_termo: ordemPorProduto.get(row.id) ?? null,
    }))
  }

  const from = (page - 1) * page_size
  const to = from + page_size - 1

  // Com termo e sem busca: pagina pelos IDs ordenados do vínculo.
  if (orderedIdsPorTermo != null && searchRaw.length === 0) {
    const total = orderedIdsPorTermo.length
    const total_pages = total === 0 ? 1 : Math.ceil(total / page_size)
    const pageIds = orderedIdsPorTermo.slice(from, to + 1)
    if (!pageIds.length) {
      return { data: [], total, page, page_size, total_pages }
    }

    const { data, error } = await admin
      .from('view_produtos_com_variacoes')
      .select(SELECT)
      .eq('workspace_id', workspaceId)
      .in('id', pageIds)

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message })
    }

    const rows = comOrdemNoTermo(
      sortByIdOrder(
        (data ?? []).map((r: Record<string, unknown>) => mapViewProdutoComVariacoesRow(r)),
        pageIds,
      ),
    )

    return { data: rows, total, page, page_size, total_pages }
  }

  // Com termo + busca: filtra na view e reordena pela ordem do vínculo.
  if (orderedIdsPorTermo != null && searchRaw.length > 0) {
    const esc = escapeIlike(searchRaw)
    const p = quotePostgrestFilterValue(`%${esc}%`)
    const { data, error } = await admin
      .from('view_produtos_com_variacoes')
      .select(SELECT)
      .eq('workspace_id', workspaceId)
      .in('id', orderedIdsPorTermo)
      .or(`nome.ilike.${p},termos_pesquisa_busca.ilike.${p}`)

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message })
    }

    const filtrados = comOrdemNoTermo(
      sortByIdOrder(
        (data ?? []).map((r: Record<string, unknown>) => mapViewProdutoComVariacoesRow(r)),
        orderedIdsPorTermo,
      ),
    )
    const total = filtrados.length
    const total_pages = total === 0 ? 1 : Math.ceil(total / page_size)
    const rows = filtrados.slice(from, to + 1)

    return { data: rows, total, page, page_size, total_pages }
  }

  let query = admin
    .from('view_produtos_com_variacoes')
    .select(SELECT, { count: 'exact' })
    .eq('workspace_id', workspaceId)

  if (searchRaw.length > 0) {
    const esc = escapeIlike(searchRaw)
    const p = quotePostgrestFilterValue(`%${esc}%`)
    query = query.or(`nome.ilike.${p},termos_pesquisa_busca.ilike.${p}`)
  }

  const { data, error, count } = await query
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .range(from, to)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const total = typeof count === 'number' && Number.isFinite(count) ? count : 0
  const total_pages = total === 0 ? 1 : Math.ceil(total / page_size)

  const rows = (data ?? []).map((r: Record<string, unknown>) => mapViewProdutoComVariacoesRow(r))

  return {
    data: rows,
    total,
    page,
    page_size,
    total_pages,
  }
})
