import { serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getRouterParam, readBody } from 'h3'
import type { EntregaPublicaResumoResponse } from '#shared/types/entrega'
import {
  buildEntregaResumo,
  codigoConfirmacaoConfere,
  loadNotificacaoByToken,
  normalizeCodigoConfirmacao,
  parseTokenEntrega,
} from '../../../../utils/entregaPublica'

type Body = {
  codigo_confirmacao?: unknown
}

const CODIGO_CONFIRM_MAX = 64

/**
 * POST /api/public/entrega/:token/entregar
 * Body: `{ codigo_confirmacao }` — gerado pelo N8N (letras, números e especiais).
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

  if (row.entrega_status !== 'no_local') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe a chegada no local antes de confirmar a entrega.',
    })
  }

  const body = (await readBody<Body>(event).catch(() => null)) ?? {}
  const codigo = normalizeCodigoConfirmacao(body.codigo_confirmacao)
  if (!codigo) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe o código de confirmação fornecido pelo cliente.',
    })
  }
  if (codigo.length > CODIGO_CONFIRM_MAX) {
    throw createError({
      statusCode: 400,
      statusMessage: `Código demasiado longo (máx. ${CODIGO_CONFIRM_MAX} caracteres).`,
    })
  }

  const esperado = normalizeCodigoConfirmacao(row.codigo_confirmacao)
  if (!esperado) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Código de confirmação ainda não está disponível para este pedido.',
    })
  }

  if (!codigoConfirmacaoConfere(codigo, esperado)) {
    throw createError({ statusCode: 400, statusMessage: 'Código de confirmação inválido.' })
  }

  const nowIso = new Date().toISOString()
  const admin = serverSupabaseServiceRole<any>(event)
  const { error: updErr } = await admin
    .from('notificacoes_ia')
    .update({
      entrega_status: 'entregue',
      entregue_at: nowIso,
      concluido: true,
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
