import { assertMethod } from 'h3'
import {
  credenciaisCanalWebhook,
  removerTodosWebhooksInstancia,
} from '../../../utils/canalConfigurarWebhook'

/**
 * POST /api/canais/configurarwebhook/remover
 * Remove todos os webhooks da instância do canal.
 * Body: `{ id_canal }`
 */
export default defineEventHandler(async (event): Promise<{ ok: true; removidos: number }> => {
  assertMethod(event, 'POST')
  const { token, servidor } = await credenciaisCanalWebhook(event)
  const removidos = await removerTodosWebhooksInstancia(servidor, token)
  return { ok: true, removidos }
})
