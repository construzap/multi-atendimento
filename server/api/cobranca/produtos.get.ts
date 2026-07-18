import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type { CobrancaProduto, ListarCobrancaProdutosResponse } from '#shared/types/cobranca'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

function parsePositiveInt(raw: unknown, label: string): number {
  if (raw === undefined || raw === null || raw === '') {
    throw createError({ statusCode: 400, statusMessage: `Informe ${label} na query.` })
  }
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  return n
}

function toNumber(raw: unknown, fallback = 0): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  const n = Number.parseFloat(String(raw ?? ''))
  return Number.isFinite(n) ? n : fallback
}

function mapProduto(row: Record<string, unknown>): CobrancaProduto {
  return {
    id: toNumber(row.id),
    cobranca_id: toNumber(row.cobranca_id),
    produto_nome: String(row.produto_nome ?? ''),
    quantidade: toNumber(row.quantidade, 1),
    preco_unitario: toNumber(row.preco_unitario),
    preco_total: toNumber(row.preco_total),
  }
}

/**
 * GET /api/cobranca/produtos?workspace_id=&cobranca_id=
 * Produtos de uma cobrança (tabela `cobranca_produtos`).
 */
export default defineEventHandler(async (event): Promise<ListarCobrancaProdutosResponse> => {
  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const query = getQuery(event)
  const workspaceId = parsePositiveInt(query.workspace_id, 'workspace_id')
  const cobrancaId = parsePositiveInt(query.cobranca_id, 'cobranca_id')
  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: cobrancaRow, error: cobrancaErr } = await admin
    .from('cobranca')
    .select('id')
    .eq('id', cobrancaId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (cobrancaErr) {
    throw createError({ statusCode: 500, statusMessage: cobrancaErr.message })
  }
  if (!cobrancaRow) {
    throw createError({ statusCode: 404, statusMessage: 'Cobrança não encontrada.' })
  }

  const { data, error } = await admin
    .from('cobranca_produtos')
    .select('id, cobranca_id, produto_nome, quantidade, preco_unitario, preco_total')
    .eq('cobranca_id', cobrancaId)
    .order('id', { ascending: true })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return {
    cobranca_id: cobrancaId,
    data: ((data ?? []) as Record<string, unknown>[]).map(mapProduto),
  }
})
