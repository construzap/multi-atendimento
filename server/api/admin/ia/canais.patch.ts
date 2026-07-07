import { serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { AdminCanalIa, AdminCanalIaAtualizarBody } from '#shared/types/adminIa'
import {
  assertAdminWorkspaceAtivo,
  parseWorkspaceId,
  requireAdminUser,
} from '../../../utils/adminPrompt'
import {
  fetchCanalCredenciaisInstancia,
  fetchCanalIaDoWorkspace,
  mapCanalIaRow,
  parseBooleanObrigatorio,
  parseCanalId,
} from '../../../utils/adminIa'
import { checkIA, getWorkspaceOwnerUserId } from '../../../utils/checkIA'
import { adicionarWebhooksInstanciaIa, requireUrlsWebhookIa } from './utils/adicionarWebhookUazapi'
import { removerWebhooksInstanciaIa, requireUrlIaN8n } from './utils/removerWebhookUazapi'

/**
 * PATCH /api/admin/ia/canais
 * Body: `{ workspace_id, id, tem_inteligencia_artificial }`
 */
export default defineEventHandler(async (event): Promise<AdminCanalIa> => {
  assertMethod(event, 'PATCH')

  await requireAdminUser(event)

  const body = await readBody<AdminCanalIaAtualizarBody>(event)
  const workspaceId = parseWorkspaceId(body?.workspace_id)
  const canalId = parseCanalId(body?.id)
  const temInteligenciaArtificial = parseBooleanObrigatorio(
    body?.tem_inteligencia_artificial,
    'tem_inteligencia_artificial',
  )

  await assertAdminWorkspaceAtivo(event, workspaceId)

  const canalAtual = await fetchCanalIaDoWorkspace(event, canalId, workspaceId)

  const credenciais = await fetchCanalCredenciaisInstancia(event, canalId, workspaceId)

  if (temInteligenciaArtificial && !canalAtual.tem_inteligencia_artificial) {
    const ownerUserId = await getWorkspaceOwnerUserId(event, workspaceId)
    await checkIA(event, ownerUserId)

    const urls = requireUrlsWebhookIa(event)
    await adicionarWebhooksInstanciaIa(credenciais.servidor, credenciais.token, [
      urls.urlIaN8n,
      urls.urlMultiatendimentoConstruzap,
    ])
  } else if (!temInteligenciaArtificial && canalAtual.tem_inteligencia_artificial) {
    const urlIaN8n = requireUrlIaN8n(event)
    await removerWebhooksInstanciaIa(credenciais.servidor, credenciais.token, urlIaN8n)
  }

  const admin = serverSupabaseServiceRole<any>(event)

  const { data, error } = await admin
    .from('canais')
    .update({ tem_inteligencia_artificial: temInteligenciaArtificial })
    .eq('id', canalId)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .is('deleted_by', null)
    .select('id, nome, descricao, provedor, tem_inteligencia_artificial, created_at')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return mapCanalIaRow(data as Record<string, unknown>)
})
