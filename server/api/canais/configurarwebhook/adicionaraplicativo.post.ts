import { assertMethod } from 'h3'
import {
  adicionarWebhookInstancia,
  credenciaisCanalWebhook,
  urlWebhookAplicativo,
} from '../../../utils/canalConfigurarWebhook'

/**
 * POST /api/canais/configurarwebhook/adicionaraplicativo
 * Registra o webhook do aplicativo (`URL_MULTIATENDIMENTO_CONSTRUZAP`) na instância do canal.
 * Body: `{ id_canal }`
 */
export default defineEventHandler(async (event): Promise<{ ok: true; url: string }> => {
  assertMethod(event, 'POST')
  const url = urlWebhookAplicativo(event)
  const { token, servidor } = await credenciaisCanalWebhook(event)
  await adicionarWebhookInstancia(servidor, token, url)
  return { ok: true, url }
})
