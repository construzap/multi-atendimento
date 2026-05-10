import { createError, getQuery } from 'h3'
import { checkSubscription } from '../../utils/checkSubscription'

/**
 * GET /api/canais/subscription?workspace_id=
 * Retorna status de assinatura e limites de canais do admin do workspace (view `vw_perfil_consolidado`).
 */
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const raw = q.workspace_id
  if (raw === undefined || raw === null || raw === '') {
    throw createError({ statusCode: 400, statusMessage: 'Informe workspace_id na query.' })
  }

  const workspaceId =
    typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  if (!Number.isFinite(workspaceId) || !Number.isInteger(workspaceId) || workspaceId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }

  return await checkSubscription(event, workspaceId)
})
