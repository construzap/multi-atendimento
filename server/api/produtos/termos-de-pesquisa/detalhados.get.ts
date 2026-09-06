import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type {
  ProdutoTermoPesquisaDetalhado,
  ProdutoTermoPesquisaDetalhadoProduto,
  ProdutosTermosPesquisaDetalhadosResponse,
} from '#shared/types/produtos'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { getAuthUserId } from '../../../utils/getAuthUserId'
import { escapeIlikeLiteral } from '../../../utils/produtoTermosPesquisa'

const PAGE_SIZE = 20

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

function parseOffset(raw: unknown): number {
  const n = Number.parseInt(String(raw ?? '0'), 10)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

function parseProdutos(raw: unknown): ProdutoTermoPesquisaDetalhadoProduto[] {
  if (!Array.isArray(raw)) return []
  const out: ProdutoTermoPesquisaDetalhadoProduto[] = []
  for (const item of raw) {
    if (item == null || typeof item !== 'object') continue
    const rec = item as { id?: unknown; nome?: unknown }
    const id = typeof rec.id === 'number' ? rec.id : Number(rec.id)
    const nome = String(rec.nome ?? '').trim()
    if (!Number.isFinite(id) || id < 1 || !nome) continue
    out.push({ id, nome })
  }
  return out
}

function mapRow(r: Record<string, unknown>): ProdutoTermoPesquisaDetalhado {
  const id = typeof r.id === 'number' ? r.id : Number(r.id)
  const workspaceId = typeof r.workspace_id === 'number' ? r.workspace_id : Number(r.workspace_id)
  const totalUsos =
    typeof r.total_usos === 'number' ? r.total_usos : Number.parseInt(String(r.total_usos ?? 0), 10)
  return {
    id: Number.isFinite(id) ? id : 0,
    nome: String(r.nome ?? '').trim(),
    workspace_id: Number.isFinite(workspaceId) ? workspaceId : 0,
    total_usos: Number.isFinite(totalUsos) ? totalUsos : 0,
    produtos: parseProdutos(r.produtos),
    em_uso: Boolean(r.em_uso),
  }
}

/**
 * GET /api/produtos/termos-de-pesquisa/detalhados?workspace_id=&offset=&q=
 * Lê `view_termos_pesquisa_detalhada` em páginas de 20.
 * Com `q`, filtra por nome (ilike).
 */
export default defineEventHandler(async (event): Promise<ProdutosTermosPesquisaDetalhadosResponse> => {
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
  const offset = parseOffset(q.offset)
  const limit = PAGE_SIZE
  const from = offset
  const to = offset + limit - 1

  const admin = serverSupabaseServiceRole<any>(event)
  let query = admin
    .from('view_termos_pesquisa_detalhada')
    .select('id, nome, workspace_id, total_usos, produtos, em_uso')
    .eq('workspace_id', workspaceId)

  // Filtro opcional por nome
  if (searchRaw.length > 0) {
    query = query.ilike('nome', `%${escapeIlikeLiteral(searchRaw)}%`)
  }

  // Sempre ordem alfabética por nome (A→Z), com ou sem busca
  const { data, error } = await query
    .order('nome', { ascending: true })
    .range(from, to)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const rows = (data ?? []).map((r: Record<string, unknown>) => mapRow(r))

  return {
    data: rows,
    has_more: rows.length === limit,
    offset,
    limit,
  }
})
