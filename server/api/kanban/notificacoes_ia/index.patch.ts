import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import {
  mapNotificacaoIaRow,
  normalizeTotalOrcamento,
  NOTIFICACAO_IA_SELECT,
} from '#shared/utils/notificacaoIaProdutos'
import { parseCoordenadasValidas, parseLatLngTexto } from '#shared/utils/navegacaoMapas'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { getAuthUserId } from '../../../utils/getAuthUserId'
import { parseNotificacaoIaProdutosBody } from '../../../utils/parseNotificacaoIaProdutosBody'

type Body = {
  workspace_id?: unknown
  id?: unknown
  entrega_status?: unknown
  produtos?: unknown
  total_orcamento?: unknown
  forma_pagamento?: unknown
  endereco?: unknown
  latitude?: unknown
  longitude?: unknown
  coordenadas?: unknown
  /** Quando informado, marca a coleta e vincula o entregador (mesmo efeito de identificar + ao coletar). */
  entregador_id?: unknown
  coletado_at?: unknown
  /** UUID da entrega. Não substitui um token já gravado. */
  token_entrega?: unknown
}

function parsePositiveInt(raw: unknown, label: string): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  return n
}

function hasOwn(body: Body, key: keyof Body): boolean {
  return Object.prototype.hasOwnProperty.call(body, key)
}

const TOKEN_ENTREGA_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function strOrNull(v: unknown): string | null {
  if (v === undefined || v === null) return null
  const s = typeof v === 'string' ? v.trim() : String(v).trim()
  return s.length ? s : null
}

/**
 * PATCH /api/kanban/notificacoes_ia
 * Body: `{ workspace_id, id, entrega_status?, produtos?, forma_pagamento?, endereco?, coordenadas?, latitude?, longitude?, total_orcamento? }`
 *
 * Atualização parcial. Envie ao menos um campo alterável.
 * Com `produtos`, recalcula `total_orcamento` (ou usa o enviado).
 * Retorna a notificação completa (mesmo shape do POST).
 */
export default defineEventHandler(async (event) => {
  assertMethod(event, 'PATCH')

  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const body = (await readBody(event)) as Body
  const workspaceId = parsePositiveInt(body.workspace_id, 'workspace_id')
  const id = parsePositiveInt(body.id, 'id')

  await checkWorkspace(event, workspaceId, userId)

  const patch: Record<string, unknown> = {}

  if (hasOwn(body, 'entregador_id')) {
    const entregadorId = parsePositiveInt(body.entregador_id, 'entregador_id')
    const adminCheck = serverSupabaseServiceRole<any>(event)
    const { data: entregador, error: entErr } = await adminCheck
      .from('entregadores')
      .select('id, ativo')
      .eq('id', entregadorId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (entErr) {
      throw createError({ statusCode: 500, statusMessage: entErr.message })
    }
    if (!entregador || entregador.ativo === false) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Entregador inválido neste workspace.',
      })
    }
    const coletadoEm = strOrNull(body.coletado_at) ?? new Date().toISOString()
    patch.entregador_id = entregadorId
    patch.entrega_status = 'coletado'
    patch.coletado_at = coletadoEm
  }

  if (hasOwn(body, 'entrega_status') && !hasOwn(body, 'entregador_id')) {
    const entregaStatus = String(body.entrega_status ?? '').trim()
    if (!entregaStatus) {
      throw createError({ statusCode: 400, statusMessage: 'entrega_status inválido.' })
    }
    patch.entrega_status = entregaStatus
  }

  if (hasOwn(body, 'forma_pagamento')) {
    const forma = strOrNull(body.forma_pagamento)
    if (!forma) {
      throw createError({ statusCode: 400, statusMessage: 'Informe a forma de pagamento.' })
    }
    patch.forma_pagamento = forma
  }

  if (hasOwn(body, 'endereco')) {
    patch.endereco = strOrNull(body.endereco)
  }

  if (
    hasOwn(body, 'coordenadas') ||
    hasOwn(body, 'latitude') ||
    hasOwn(body, 'longitude')
  ) {
    let latitude: number | null = null
    let longitude: number | null = null

    const coordsTexto = parseLatLngTexto(body.coordenadas)
    if (coordsTexto === undefined) {
      throw createError({
        statusCode: 400,
        statusMessage: 'coordenadas inválidas. Use o formato: latitude, longitude',
      })
    }
    if (coordsTexto) {
      latitude = coordsTexto.lat
      longitude = coordsTexto.lng
    } else if (
      (body.latitude != null && String(body.latitude).trim() !== '') ||
      (body.longitude != null && String(body.longitude).trim() !== '')
    ) {
      const coordsSeparadas = parseCoordenadasValidas(body.latitude, body.longitude)
      if (!coordsSeparadas) {
        throw createError({
          statusCode: 400,
          statusMessage: 'latitude/longitude inválidas.',
        })
      }
      latitude = coordsSeparadas.lat
      longitude = coordsSeparadas.lng
    }
    // Coordenadas vazias limpam lat/lng
    patch.latitude = latitude
    patch.longitude = longitude
  }

  if (hasOwn(body, 'produtos')) {
    const { itens, total: totalCalculado } = parseNotificacaoIaProdutosBody(body.produtos)
    const totalBody =
      body.total_orcamento != null
        ? normalizeTotalOrcamento(body.total_orcamento)
        : totalCalculado
    patch.produtos = itens
    patch.total_orcamento = totalBody
  } else if (hasOwn(body, 'total_orcamento')) {
    patch.total_orcamento = normalizeTotalOrcamento(body.total_orcamento)
  }

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: row, error: findErr } = await admin
    .from('notificacoes_ia')
    .select('id, workspace_id, token_entrega')
    .eq('id', id)
    .maybeSingle()

  if (findErr) {
    throw createError({ statusCode: 500, statusMessage: findErr.message })
  }
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Notificação não encontrada.' })
  }

  const wsRow =
    typeof row.workspace_id === 'number'
      ? row.workspace_id
      : Number.parseInt(String(row.workspace_id ?? ''), 10)
  if (!Number.isFinite(wsRow) || wsRow !== workspaceId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Esta notificação não pertence ao workspace informado.',
    })
  }

  if (hasOwn(body, 'token_entrega')) {
    const token = strOrNull(body.token_entrega)?.toLowerCase() ?? ''
    if (!TOKEN_ENTREGA_RE.test(token)) {
      throw createError({ statusCode: 400, statusMessage: 'token_entrega inválido.' })
    }
    const atual =
      row.token_entrega != null && String(row.token_entrega).trim()
        ? String(row.token_entrega).trim().toLowerCase()
        : null
    if (atual && atual !== token) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Este pedido já tem token de entrega.',
      })
    }
    patch.token_entrega = token
  }

  if (Object.keys(patch).length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nenhum campo para atualizar.',
    })
  }

  patch.updated_at = new Date().toISOString()

  const { data: updated, error: updErr } = await admin
    .from('notificacoes_ia')
    .update(patch)
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select(NOTIFICACAO_IA_SELECT)
    .maybeSingle()

  if (updErr) {
    throw createError({ statusCode: 500, statusMessage: updErr.message })
  }
  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Notificação não encontrada.' })
  }

  const notificacao = mapNotificacaoIaRow(updated as Record<string, unknown>)

  return {
    ok: true as const,
    id: notificacao.id,
    entrega_status: notificacao.entrega_status,
    updated_at: notificacao.updated_at,
    notificacao,
  }
})
