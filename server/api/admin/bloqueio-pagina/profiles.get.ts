import { serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getQuery } from 'h3'
import type {
  AdminBloqueioProfileItem,
  AdminBloqueioProfilesResponse,
} from '#shared/types/adminBloqueioPagina'
import {
  assertAdminWorkspaceAtivo,
  parseWorkspaceId,
  requireAdminUser,
} from '../../../utils/adminPrompt'
import { getWorkspaceOwnerUserId } from '../../../utils/checkIA'

/**
 * GET /api/admin/bloqueio-pagina/profiles?workspace_id=
 * Lista profiles do dono do workspace + atendentes vinculados.
 */
export default defineEventHandler(async (event): Promise<AdminBloqueioProfilesResponse> => {
  assertMethod(event, 'GET')

  await requireAdminUser(event)

  const q = getQuery(event)
  const workspaceId = parseWorkspaceId(q.workspace_id)
  await assertAdminWorkspaceAtivo(event, workspaceId)

  const ownerUserId = await getWorkspaceOwnerUserId(event, workspaceId)
  const admin = serverSupabaseServiceRole<any>(event)

  const { data: atendentesRows, error: atendentesErr } = await admin
    .from('atendentes')
    .select('atendente_user_id')
    .eq('workspace_id', workspaceId)

  if (atendentesErr) {
    throw createError({ statusCode: 500, statusMessage: atendentesErr.message })
  }

  const atendenteIds = new Set<string>()
  for (const row of atendentesRows ?? []) {
    const uid = String((row as { atendente_user_id?: unknown }).atendente_user_id ?? '').trim()
    if (uid) atendenteIds.add(uid)
  }

  const userIds = [...new Set([ownerUserId, ...atendenteIds])]

  if (!userIds.length) {
    return {
      workspace_id: workspaceId,
      owner_user_id: ownerUserId,
      items: [],
    }
  }

  const { data: profilesRows, error: profilesErr } = await admin
    .from('profiles')
    .select('id, user_id, full_name, email, whatsapp')
    .in('user_id', userIds)

  if (profilesErr) {
    throw createError({ statusCode: 500, statusMessage: profilesErr.message })
  }

  const byUserId = new Map<string, AdminBloqueioProfileItem>()

  for (const row of profilesRows ?? []) {
    const r = row as Record<string, unknown>
    const userId = String(r.user_id ?? '').trim()
    if (!userId) continue

    const profileIdRaw = r.id
    const profileId =
      typeof profileIdRaw === 'number'
        ? profileIdRaw
        : Number.parseInt(String(profileIdRaw ?? ''), 10)

    byUserId.set(userId, {
      profile_id: Number.isFinite(profileId) && profileId > 0 ? profileId : null,
      user_id: userId,
      full_name: r.full_name == null ? null : String(r.full_name).trim() || null,
      email: r.email == null ? null : String(r.email).trim() || null,
      whatsapp: r.whatsapp == null ? null : String(r.whatsapp).trim() || null,
      is_owner: userId === ownerUserId,
      is_atendente: atendenteIds.has(userId),
    })
  }

  // Garante que IDs sem profile ainda apareçam
  for (const userId of userIds) {
    if (byUserId.has(userId)) continue
    byUserId.set(userId, {
      profile_id: null,
      user_id: userId,
      full_name: null,
      email: null,
      whatsapp: null,
      is_owner: userId === ownerUserId,
      is_atendente: atendenteIds.has(userId),
    })
  }

  const items = [...byUserId.values()].sort((a, b) => {
    if (a.is_owner !== b.is_owner) return a.is_owner ? -1 : 1
    const nomeA = (a.full_name || a.email || a.user_id).toLowerCase()
    const nomeB = (b.full_name || b.email || b.user_id).toLowerCase()
    return nomeA.localeCompare(nomeB, 'pt-BR')
  })

  return {
    workspace_id: workspaceId,
    owner_user_id: ownerUserId,
    items,
  }
})
