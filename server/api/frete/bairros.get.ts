import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getQuery } from 'h3'
import type { FreteBairroListaItem, FreteBairrosListaResponse } from '#shared/types/frete'
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

const LIMITE_MAX_BAIRROS = 5000

function parseLimit(raw: unknown, fallback: number): number {
  if (raw === undefined || raw === null || raw === '') return fallback
  const n = Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return fallback
  return Math.min(LIMITE_MAX_BAIRROS, Math.max(1, n))
}

function mapListaRow(r: Record<string, unknown>): FreteBairroListaItem {
  const id = typeof r.id === 'number' ? r.id : Number(r.id)
  const valorRaw = r.valor_frete
  let valor_frete: number | null = null
  if (valorRaw !== undefined && valorRaw !== null && valorRaw !== '') {
    const v = typeof valorRaw === 'number' ? valorRaw : Number.parseFloat(String(valorRaw))
    valor_frete = Number.isFinite(v) ? Math.round(v * 100) / 100 : null
  }
  return {
    id: Number.isFinite(id) ? id : 0,
    bairro: String(r.bairro ?? '').trim(),
    valor_frete,
    frete_gratis: Boolean(r.frete_gratis),
  }
}

/**
 * GET /api/frete/bairros?workspace_id=&limit=
 *
 * Lista `frete_bairro_workspace` ativos do workspace: `id`, `bairro`, `valor_frete`, `frete_gratis`.
 * `limit` opcional (padrão 5000, máx. 5000).
 */
export default defineEventHandler(async (event): Promise<FreteBairrosListaResponse> => {
  assertMethod(event, 'GET')

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
  const limit = parseLimit(q.limit, LIMITE_MAX_BAIRROS)

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)
  const { data, error } = await admin
    .from('frete_bairro_workspace')
    .select('id, bairro, valor_frete, frete_gratis')
    .eq('workspace_id', workspaceId)
    .eq('ativo', true)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const rows = (data ?? []) as Record<string, unknown>[]
  return {
    data: rows.map(mapListaRow),
  }
})
