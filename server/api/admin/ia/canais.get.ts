import { serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getQuery } from 'h3'
import type { AdminCanalIaListResponse } from '#shared/types/adminIa'
import {
  assertAdminWorkspaceAtivo,
  parseWorkspaceId,
  requireAdminUser,
} from '../../../utils/adminPrompt'
import { mapCanalIaRow } from '../../../utils/adminIa'
import { fetchPerfilIaLimites, getWorkspaceOwnerUserId } from '../../../utils/checkIA'

/**
 * GET /api/admin/ia/canais?workspace_id=&owner_user_id=
 * Lista canais do workspace e limites de I.A do dono (`vw_perfil_consolidado`).
 */
export default defineEventHandler(async (event): Promise<AdminCanalIaListResponse> => {
  assertMethod(event, 'GET')

  await requireAdminUser(event)

  const q = getQuery(event)
  const workspaceId = parseWorkspaceId(q.workspace_id)
  await assertAdminWorkspaceAtivo(event, workspaceId)

  const ownerUserId = await getWorkspaceOwnerUserId(event, workspaceId)

  const ownerInformado = q.owner_user_id
  if (ownerInformado != null && String(ownerInformado).trim() !== '') {
    const informado = String(ownerInformado).trim()
    if (informado !== ownerUserId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'owner_user_id não corresponde ao dono do workspace.',
      })
    }
  }

  const admin = serverSupabaseServiceRole<any>(event)

  const [canaisResult, perfil] = await Promise.all([
    admin
      .from('canais')
      .select('id, nome, descricao, provedor, tem_inteligencia_artificial, created_at')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .is('deleted_by', null)
      .order('created_at', { ascending: false }),
    fetchPerfilIaLimites(event, ownerUserId),
  ])

  if (canaisResult.error) {
    throw createError({ statusCode: 500, statusMessage: canaisResult.error.message })
  }

  const items = (canaisResult.data ?? []).map((row) =>
    mapCanalIaRow(row as Record<string, unknown>),
  )

  return { items, perfil }
})
