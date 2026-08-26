import { serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getRouterParam, readBody } from 'h3'
import type { EntregaPublicaResumoResponse } from '#shared/types/entrega'
import {
  buildEntregaResumo,
  loadNotificacaoByToken,
  parseTokenEntrega,
} from '../../../../utils/entregaPublica'

type Body = {
  acao?: unknown
}

/**
 * POST /api/public/entrega/:token/status
 * Body: `{ acao: 'coletado' | 'no_local' }` — avanço linear.
 */
export default defineEventHandler(async (event): Promise<EntregaPublicaResumoResponse> => {
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

  if (acao === 'coletado') {
    if (row.entrega_status !== 'aguardando_entregador') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Só é possível marcar coleta a partir do status inicial.',
      })
    }
    patch.entrega_status = 'coletado'
    patch.coletado_at = nowIso
  } else {
    if (row.entrega_status !== 'coletado') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Marque a coleta antes de informar chegada no local.',
      })
    }
    patch.entrega_status = 'no_local'
    patch.no_local_at = nowIso
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
  return { ok: true, data }
})
