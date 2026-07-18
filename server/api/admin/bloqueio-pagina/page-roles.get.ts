import { serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getQuery } from 'h3'
import type { PageRoleRow } from '#shared/types/pageRoles'
import type { AdminBloqueioPageRolesResponse } from '#shared/types/adminBloqueioPagina'
import {
  assertAdminWorkspaceAtivo,
  parseWorkspaceId,
  requireAdminUser,
} from '../../../utils/adminPrompt'

function mapPageRoleRow(r: Record<string, unknown>): PageRoleRow | null {
  const id = typeof r.id === 'number' ? r.id : Number(r.id)
  const workspaceId = typeof r.workspace_id === 'number' ? r.workspace_id : Number(r.workspace_id)
  const profileId = typeof r.profile_id === 'number' ? r.profile_id : Number(r.profile_id)

  if (
    !Number.isFinite(id) ||
    !Number.isFinite(workspaceId) ||
    !Number.isFinite(profileId) ||
    id < 1 ||
    workspaceId < 1 ||
    profileId < 1
  ) {
    return null
  }

  const pagesRaw = r.pages
  const pages = Array.isArray(pagesRaw)
    ? pagesRaw.map((p) => String(p ?? '').trim()).filter(Boolean)
    : []

  return {
    id,
    workspace_id: workspaceId,
    profile_id: profileId,
    pages,
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
  }
}

/**
 * GET /api/admin/bloqueio-pagina/page-roles?workspace_id=
 * Lista todas as regras de `page_roles` do workspace.
 */
export default defineEventHandler(async (event): Promise<AdminBloqueioPageRolesResponse> => {
  assertMethod(event, 'GET')

  await requireAdminUser(event)

  const q = getQuery(event)
  const workspaceId = parseWorkspaceId(q.workspace_id)
  await assertAdminWorkspaceAtivo(event, workspaceId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data, error } = await admin
    .from('page_roles')
    .select('id, workspace_id, profile_id, pages, created_at, updated_at')
    .eq('workspace_id', workspaceId)
    .order('id', { ascending: true })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const items = (data ?? [])
    .map((row) => mapPageRoleRow(row as Record<string, unknown>))
    .filter((x): x is PageRoleRow => x != null)

  return {
    workspace_id: workspaceId,
    items,
  }
})
