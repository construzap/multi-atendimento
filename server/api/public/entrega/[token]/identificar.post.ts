import { serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getRouterParam, readBody } from 'h3'
import type { EntregaPublicaResumoResponse } from '#shared/types/entrega'
import type { EntregaAoColetarResult } from '../../../../utils/entregaAoColetar'
import { executarAutomacaoAoColetar } from '../../../../utils/entregaAoColetar'
import {
  buildEntregaResumo,
  loadNotificacaoByToken,
  normalizeCodigoEntregador,
  parseTokenEntrega,
} from '../../../../utils/entregaPublica'

type Body = {
  codigo?: unknown
}

export type EntregaIdentificarResponse = EntregaPublicaResumoResponse & {
  coleta: EntregaAoColetarResult | null
  coleta_erro: string | null
}

/**
 * POST /api/public/entrega/:token/identificar
 * Body: `{ codigo }` — código do entregador (ex. ENT-042).
 * Após validar, vincula o entregador, marca `entrega_status = coletado`
 * e executa a automação de funil/coluna/webhook.
 */
export default defineEventHandler(async (event): Promise<EntregaIdentificarResponse> => {
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
    .select('id, nome, ativo, entregador_premium')
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
      entrega_status: 'coletado',
      coletado_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', row.id)
    .eq('token_entrega', token)

  if (updErr) {
    throw createError({ statusCode: 500, statusMessage: updErr.message })
  }

  const updated = await loadNotificacaoByToken(event, token)
  const data = await buildEntregaResumo(event, updated)

  let coleta: EntregaAoColetarResult | null = null
  let coleta_erro: string | null = null
  try {
    coleta = await executarAutomacaoAoColetar(event, updated)
  } catch (e) {
    coleta_erro =
      e && typeof e === 'object' && 'statusMessage' in e
        ? String((e as { statusMessage?: unknown }).statusMessage ?? '')
        : e instanceof Error
          ? e.message
          : 'Falha na automação de coleta (funil/coluna).'
    if (!coleta_erro) coleta_erro = 'Falha na automação de coleta (funil/coluna).'
    console.warn('[entrega/identificar] automação ao coletar:', coleta_erro)
  }

  return { ok: true, data, coleta, coleta_erro }
})
