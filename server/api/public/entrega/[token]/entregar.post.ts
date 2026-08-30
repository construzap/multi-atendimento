import { serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getRouterParam, readBody } from 'h3'
import type { EntregaPublicaResumoResponse } from '#shared/types/entrega'
import type { EntregaAoColetarResult } from '../../../../utils/entregaAoColetar'
import { executarAutomacaoEtapaKanban } from '../../../../utils/entregaAoColetar'
import {
  buildEntregaResumo,
  codigoConfirmacaoConfere,
  isEntregadorPremiumById,
  loadNotificacaoByToken,
  normalizeCodigoConfirmacao,
  parseTokenEntrega,
} from '../../../../utils/entregaPublica'

type Body = {
  codigo_confirmacao?: unknown
}

const CODIGO_CONFIRM_MAX = 64

export type EntregaEntregarResponse = EntregaPublicaResumoResponse & {
  coleta: EntregaAoColetarResult | null
  coleta_erro: string | null
}

/**
 * POST /api/public/entrega/:token/entregar
 * Body: `{ codigo_confirmacao }` — gerado pelo N8N (letras, números e especiais).
 * Entregador premium pode confirmar sem o código.
 * Após confirmar, move a conversa para a coluna ordem 7 do funil ordem 1.
 */
export default defineEventHandler(async (event): Promise<EntregaEntregarResponse> => {
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

  const premium = await isEntregadorPremiumById(event, row.workspace_id, row.entregador_id)

  if (!premium) {
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
  }

  const nowIso = new Date().toISOString()
  const admin = serverSupabaseServiceRole<any>(event)
  const { error: updErr } = await admin
    .from('notificacoes_ia')
    .update({
      entrega_status: 'entregue',
      entregue_at: nowIso,
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
    coleta = await executarAutomacaoEtapaKanban(event, updated, 'entregue')
  } catch (e) {
    coleta_erro =
      e && typeof e === 'object' && 'statusMessage' in e
        ? String((e as { statusMessage?: unknown }).statusMessage ?? '')
        : e instanceof Error
          ? e.message
          : 'Falha na automação de kanban (funil/coluna).'
    if (!coleta_erro) coleta_erro = 'Falha na automação de kanban (funil/coluna).'
    console.warn('[entrega/entregar] automação:', coleta_erro)
  }

  return { ok: true, data, coleta, coleta_erro }
})
