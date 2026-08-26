import { assertMethod, getRouterParam } from 'h3'
import type { EntregaPublicaResumoResponse } from '#shared/types/entrega'
import {
  buildEntregaResumo,
  loadNotificacaoByToken,
  parseTokenEntrega,
} from '../../../../utils/entregaPublica'

/**
 * GET /api/public/entrega/:token
 * Resumo seguro do pedido (nunca retorna codigo_confirmacao).
 */
export default defineEventHandler(async (event): Promise<EntregaPublicaResumoResponse> => {
  assertMethod(event, 'GET')

  const token = parseTokenEntrega(getRouterParam(event, 'token'))
  const row = await loadNotificacaoByToken(event, token)
  const data = await buildEntregaResumo(event, row)

  return { ok: true, data }
})
