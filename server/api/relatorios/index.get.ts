import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getQuery } from 'h3'
import type {
  RelatorioClienteConversa,
  RelatorioPedidoProntoItem,
  RelatoriosListResponse,
} from '#shared/types/relatorios'
import {
  normalizeEntregaStatus,
  normalizeProdutosRaw,
  normalizeTotalOrcamento,
} from '#shared/utils/notificacaoIaProdutos'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

const SELECT = [
  'id',
  'forma_pagamento',
  'total_orcamento',
  'pagamento_realizado',
  'created_at',
  'entrega_ou_retirada',
  'entrega_status',
  'coletado_at',
  'no_local_at',
  'entregue_at',
  'canal_id',
  'entregador_id',
  'conversa_key',
  'produtos',
  'canais ( nome )',
  'entregadores ( nome )',
  'conversas!notificacoes_ia_conversa_key_fkey ( name, phone, photo, latitude, longitude, coluna_id, funil_id )',
].join(', ')

function parseWorkspaceId(raw: unknown): number {
  const n =
    typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }
  return n
}

/** Aceita ISO ou string parseável; null se vazio/inválido. */
function parseIsoOrNull(raw: unknown): string | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'Data inválida (de/ate).' })
  }
  return d.toISOString()
}

function numOrNull(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) ? n : null
}

function intOrNull(raw: unknown): number | null {
  const n = numOrNull(raw)
  if (n == null) return null
  const i = Math.trunc(n)
  return i >= 1 ? i : null
}

function nestedCliente(raw: unknown): RelatorioClienteConversa | null {
  const row = Array.isArray(raw) ? raw[0] : raw
  if (!row || typeof row !== 'object') return null
  const o = row as Record<string, unknown>
  const name = o.name != null ? String(o.name).trim() : ''
  const phone = o.phone != null ? String(o.phone).trim() : ''
  const photo = o.photo != null ? String(o.photo).trim() : ''
  return {
    name: name || null,
    phone: phone || null,
    photo: photo || null,
    latitude: numOrNull(o.latitude),
    longitude: numOrNull(o.longitude),
    coluna_id: intOrNull(o.coluna_id),
    funil_id: intOrNull(o.funil_id),
  }
}

function nestedNome(raw: unknown): string | null {
  if (raw == null) return null
  if (Array.isArray(raw)) {
    const first = raw[0]
    if (first && typeof first === 'object') {
      const n = (first as Record<string, unknown>).nome
      const s = n != null ? String(n).trim() : ''
      return s || null
    }
    return null
  }
  if (typeof raw === 'object') {
    const n = (raw as Record<string, unknown>).nome
    const s = n != null ? String(n).trim() : ''
    return s || null
  }
  return null
}

function mapRow(r: Record<string, unknown>): RelatorioPedidoProntoItem | null {
  const id = typeof r.id === 'number' ? r.id : Number(r.id)
  if (!Number.isFinite(id) || id < 1) return null

  const canalId = typeof r.canal_id === 'number' ? r.canal_id : Number(r.canal_id)
  if (!Number.isFinite(canalId) || canalId < 1) return null

  const conversaKey = r.conversa_key != null ? String(r.conversa_key).trim() : ''
  if (!conversaKey) return null

  const entregadorRaw = r.entregador_id
  let entregador_id: number | null = null
  if (entregadorRaw != null && entregadorRaw !== '') {
    const n = typeof entregadorRaw === 'number' ? entregadorRaw : Number(entregadorRaw)
    if (Number.isFinite(n) && n >= 1) entregador_id = n
  }

  const isoOrNull = (v: unknown): string | null => {
    if (v == null || v === '') return null
    const s = String(v)
    return s || null
  }

  return {
    id,
    forma_pagamento: r.forma_pagamento != null ? String(r.forma_pagamento) : null,
    total_orcamento: normalizeTotalOrcamento(r.total_orcamento),
    pagamento_realizado: r.pagamento_realizado === true,
    created_at: r.created_at != null ? String(r.created_at) : '',
    entrega_ou_retirada:
      r.entrega_ou_retirada != null ? String(r.entrega_ou_retirada) : null,
    entrega_status: normalizeEntregaStatus(r.entrega_status),
    coletado_at: isoOrNull(r.coletado_at),
    no_local_at: isoOrNull(r.no_local_at),
    entregue_at: isoOrNull(r.entregue_at),
    canal_id: canalId,
    canal_nome: nestedNome(r.canais),
    entregador_id,
    entregador_nome: nestedNome(r.entregadores),
    conversa_key: conversaKey,
    cliente: nestedCliente(r.conversas),
    produtos: normalizeProdutosRaw(r.produtos),
  }
}

/**
 * GET /api/relatorios?workspace_id=&de=&ate=
 * Lista `notificacoes_ia` do workspace com `tipo_solicitacao = pedido_pronto`.
 * `de` / `ate` filtram `created_at` (ISO).
 */
export default defineEventHandler(async (event): Promise<RelatoriosListResponse> => {
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
  const workspaceId = parseWorkspaceId(q.workspace_id)
  await checkWorkspace(event, workspaceId, userId)

  const deIso = parseIsoOrNull(q.de)
  const ateIso = parseIsoOrNull(q.ate)
  if (deIso && ateIso && deIso > ateIso) {
    throw createError({ statusCode: 400, statusMessage: 'Período inválido: "de" é posterior a "até".' })
  }

  const admin = serverSupabaseServiceRole<any>(event)
  let query = admin
    .from('notificacoes_ia')
    .select(SELECT)
    .eq('workspace_id', workspaceId)
    .eq('tipo_solicitacao', 'pedido_pronto')
    .order('created_at', { ascending: false })

  if (deIso) query = query.gte('created_at', deIso)
  if (ateIso) query = query.lte('created_at', ateIso)

  const { data, error } = await query

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const mapped = ((data ?? []) as Record<string, unknown>[])
    .map(mapRow)
    .filter((x): x is RelatorioPedidoProntoItem => x != null)

  return { data: mapped }
})
