import { assertMethod } from 'h3'
import {
  adicionarWebhookInstancia,
  credenciaisCanalWebhook,
  urlWebhookN8n,
} from '../../../utils/canalConfigurarWebhook'

/**
 * POST /api/canais/configurarwebhook/adicionarn8n
 * Registra o webhook do n8n (`URL_IA_N8N`) na instância do canal.
 * Body: `{ id_canal }`
 */
export default defineEventHandler(async (event): Promise<{ ok: true; url: string }> => {
  assertMethod(event, 'POST')
  const url = urlWebhookN8n(event)
  const { token, servidor } = await credenciaisCanalWebhook(event)
  await adicionarWebhookInstancia(servidor, token, url)
  return { ok: true, url }
})
