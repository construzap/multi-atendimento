import { checkSubscription } from '../../utils/checkSubscription'

/**
 * GET /api/canais/subscription
 * Retorna status de assinatura e limites de canais (view `vw_perfil_consolidado`).
 */
export default defineEventHandler(async (event) => {
  return await checkSubscription(event)
})
