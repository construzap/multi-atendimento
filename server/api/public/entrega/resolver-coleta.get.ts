import { assertMethod, createError, getQuery } from 'h3'
import {
  ENTREGA_COLUNA_ORDEM_COLETA,
  ENTREGA_FUNIL_ORDEM,
  resolverFunilColunaColeta,
} from '../../../utils/entregaAoColetar'
import { parseTokenEntrega, loadNotificacaoByToken } from '../../../utils/entregaPublica'

/**
 * GET /api/public/entrega/resolver-coleta?token=
 *
 * Com o token do pedido, resolve funil (ordem 1) + coluna (ordem 5) do workspace.
 */
export default defineEventHandler(async (event) => {
  assertMethod(event, 'GET')

  const q = getQuery(event)
  const token = parseTokenEntrega(q.token)
  const row = await loadNotificacaoByToken(event, token)

  if (row.entrega_status === 'aguardando_entregador' && row.entregador_id == null) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Identifique o entregador antes de resolver a coleta.',
    })
  }

  const resolvido = await resolverFunilColunaColeta(event, row.workspace_id)

  return {
    ok: true as const,
    workspace_id: row.workspace_id,
    conversa_key: row.conversa_key,
    funil_ordem: ENTREGA_FUNIL_ORDEM,
    coluna_ordem: ENTREGA_COLUNA_ORDEM_COLETA,
    funil_id: resolvido.funil_id,
    coluna_id: resolvido.coluna_id,
    id_agendamento_mensagem: resolvido.id_agendamento_mensagem,
  }
})
