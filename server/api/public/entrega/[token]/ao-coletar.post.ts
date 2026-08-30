import { assertMethod, getRouterParam } from 'h3'
import type { EntregaPublicaResumoResponse } from '#shared/types/entrega'
import type { EntregaAoColetarResult } from '../../../../utils/entregaAoColetar'
import { executarAutomacaoAoColetar } from '../../../../utils/entregaAoColetar'
import {
  buildEntregaResumo,
  loadNotificacaoByToken,
  parseTokenEntrega,
} from '../../../../utils/entregaPublica'

export type EntregaAoColetarResponse = {
  ok: true
  data: EntregaPublicaResumoResponse['data']
  coleta: EntregaAoColetarResult
}

/**
 * POST /api/public/entrega/:token/ao-coletar
 *
 * Resolve funil (ordem 1) + coluna (ordem 5), atualiza a conversa
 * e dispara webhook de agendamento se a coluna tiver `id_agendamento_mensagem`.
 *
 * Normalmente chamado automaticamente após marcar `coletado`.
 */
export default defineEventHandler(async (event): Promise<EntregaAoColetarResponse> => {
  assertMethod(event, 'POST')

  const token = parseTokenEntrega(getRouterParam(event, 'token'))
  const row = await loadNotificacaoByToken(event, token)
  const coleta = await executarAutomacaoAoColetar(event, row)
  const data = await buildEntregaResumo(event, row)

  return { ok: true, data, coleta }
})
