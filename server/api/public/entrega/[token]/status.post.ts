import { serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getRouterParam, readBody } from 'h3'
import type { EntregaPublicaResumoResponse } from '#shared/types/entrega'
import type { EntregaAoColetarResult } from '../../../../utils/entregaAoColetar'
import { executarAutomacaoEtapaKanban } from '../../../../utils/entregaAoColetar'
import {
  buildEntregaResumo,
  loadNotificacaoByToken,
  parseTokenEntrega,
} from '../../../../utils/entregaPublica'

type Body = {
  acao?: unknown
}

export type EntregaStatusResponse = EntregaPublicaResumoResponse & {
  coleta?: EntregaAoColetarResult | null
  coleta_erro?: string | null
}

/**
 * POST /api/public/entrega/:token/status
 * Body: `{ acao: 'coletado' | 'no_local' }`
 * - coletado → coluna ordem 5
 * - no_local → coluna ordem 6
 */
export default defineEventHandler(async (event): Promise<EntregaStatusResponse> => {
  assertMethod(event, 'POST')

  const token = parseTokenEntrega(getRouterParam(event, 'token'))
  const row = await loadNotificacaoByToken(event, token)

  if (row.entrega_status === 'entregue') {
    throw createError({ statusCode: 400, statusMessage: 'Esta entrega já foi concluída.' })
  }

  if (row.entregador_id == null) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Identifique-se com o código do entregador antes de continuar.',
    })
  }

  const body = (await readBody<Body>(event).catch(() => null)) ?? {}
  const acao = String(body.acao ?? '').trim().toLowerCase()

  if (acao !== 'coletado' && acao !== 'no_local') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Ação inválida. Use coletado ou no_local.',
    })
  }

  const nowIso = new Date().toISOString()
  const patch: Record<string, unknown> = { updated_at: nowIso }
  let etapaKanban: 'coletado' | 'no_local' | null = null
  let tambemColetarAntes = false

  if (acao === 'coletado') {
    if (row.entrega_status !== 'aguardando_entregador') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Só é possível marcar coleta a partir do status inicial.',
      })
    }
    patch.entrega_status = 'coletado'
    patch.coletado_at = nowIso
    etapaKanban = 'coletado'
  } else {
    if (
      row.entrega_status !== 'coletado' &&
      row.entrega_status !== 'aguardando_entregador'
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Status inválido para informar chegada no local.',
      })
    }
    if (row.entrega_status === 'aguardando_entregador') {
      patch.coletado_at = nowIso
      tambemColetarAntes = true
    }
    patch.entrega_status = 'no_local'
    patch.no_local_at = nowIso
    etapaKanban = 'no_local'
  }

  const admin = serverSupabaseServiceRole<any>(event)
  const { error: updErr } = await admin
    .from('notificacoes_ia')
    .update(patch)
    .eq('id', row.id)
    .eq('token_entrega', token)

  if (updErr) {
    throw createError({ statusCode: 500, statusMessage: updErr.message })
  }

  const updated = await loadNotificacaoByToken(event, token)
  const data = await buildEntregaResumo(event, updated)

  if (!etapaKanban) {
    return { ok: true, data }
  }

  let coleta: EntregaAoColetarResult | null = null
  let coleta_erro: string | null = null
  try {
    if (tambemColetarAntes) {
      await executarAutomacaoEtapaKanban(event, updated, 'coletado')
    }
    coleta = await executarAutomacaoEtapaKanban(event, updated, etapaKanban)
  } catch (e) {
    coleta_erro =
      e && typeof e === 'object' && 'statusMessage' in e
        ? String((e as { statusMessage?: unknown }).statusMessage ?? '')
        : e instanceof Error
          ? e.message
          : 'Falha na automação de kanban (funil/coluna).'
    if (!coleta_erro) coleta_erro = 'Falha na automação de kanban (funil/coluna).'
    console.warn('[entrega/status] automação:', coleta_erro)
  }

  return { ok: true, data, coleta, coleta_erro }
})
