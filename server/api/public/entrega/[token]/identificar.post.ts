import { serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getRouterParam, readBody } from 'h3'
import type { EntregaPublicaResumoResponse } from '#shared/types/entrega'
import {
  buildEntregaResumo,
  loadNotificacaoByToken,
  normalizeCodigoEntregador,
  parseTokenEntrega,
} from '../../../../utils/entregaPublica'

type Body = {
  codigo?: unknown
}

/**
 * POST /api/public/entrega/:token/identificar
 * Body: `{ codigo }` — código do entregador (ex. ENT-042).
 */
export default defineEventHandler(async (event): Promise<EntregaPublicaResumoResponse> => {
  assertMethod(event, 'POST')

  const token = parseTokenEntrega(getRouterParam(event, 'token'))
  const row = await loadNotificacaoByToken(event, token)

  if (row.entrega_status === 'entregue') {
    throw createError({ statusCode: 400, statusMessage: 'Esta entrega já foi concluída.' })
  }

  if (row.entregador_id != null) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Já existe um entregador identificado neste pedido.',
    })
  }

  if (row.entrega_status !== 'aguardando_entregador') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Não é possível identificar o entregador neste status.',
    })
  }

  const body = (await readBody<Body>(event).catch(() => null)) ?? {}
  const codigo = normalizeCodigoEntregador(body.codigo)
  if (!codigo) {
    throw createError({ statusCode: 400, statusMessage: 'Informe o código do entregador.' })
  }

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: entregador, error: entErr } = await admin
    .from('entregadores')
    .select('id, nome, ativo')
    .eq('workspace_id', row.workspace_id)
    .eq('codigo', codigo)
    .maybeSingle()

  if (entErr) {
    throw createError({ statusCode: 500, statusMessage: entErr.message })
  }

  if (!entregador || entregador.ativo !== true) {
    throw createError({ statusCode: 404, statusMessage: 'Código de entregador inválido.' })
  }

  const entregadorId =
    typeof entregador.id === 'number' ? entregador.id : Number.parseInt(String(entregador.id), 10)
  if (!Number.isFinite(entregadorId) || entregadorId < 1) {
    throw createError({ statusCode: 500, statusMessage: 'Entregador inválido.' })
  }

  const nowIso = new Date().toISOString()
  const { error: updErr } = await admin
    .from('notificacoes_ia')
    .update({
      entregador_id: entregadorId,
      updated_at: nowIso,
    })
    .eq('id', row.id)
    .eq('token_entrega', token)

  if (updErr) {
    throw createError({ statusCode: 500, statusMessage: updErr.message })
  }

  const updated = await loadNotificacaoByToken(event, token)
  const data = await buildEntregaResumo(event, updated)
  return { ok: true, data }
})
