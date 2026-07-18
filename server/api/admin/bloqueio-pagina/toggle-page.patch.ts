import { serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { PageRoleRow } from '#shared/types/pageRoles'
import type {
  AdminBloqueioTogglePageBody,
  AdminBloqueioTogglePageResponse,
} from '#shared/types/adminBloqueioPagina'
import {
  assertAdminWorkspaceAtivo,
  parseWorkspaceId,
  requireAdminUser,
} from '../../../utils/adminPrompt'

function parseProfileId(raw: unknown): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)

  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'profile_id inválido.' })
  }
  return n
}

function parsePageSlug(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!s) {
    throw createError({ statusCode: 400, statusMessage: 'page é obrigatório.' })
  }
  return s
}

function parseEnabled(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw
  throw createError({ statusCode: 400, statusMessage: 'enabled deve ser boolean.' })
}

function mapPageRoleRow(r: Record<string, unknown>): PageRoleRow {
  const id = typeof r.id === 'number' ? r.id : Number(r.id)
  const workspaceId = typeof r.workspace_id === 'number' ? r.workspace_id : Number(r.workspace_id)
  const profileId = typeof r.profile_id === 'number' ? r.profile_id : Number(r.profile_id)
  const pagesRaw = r.pages
  const pages = Array.isArray(pagesRaw)
    ? pagesRaw.map((p) => String(p ?? '').trim()).filter(Boolean)
    : []

  return {
    id: Number.isFinite(id) ? id : 0,
    workspace_id: Number.isFinite(workspaceId) ? workspaceId : 0,
    profile_id: Number.isFinite(profileId) ? profileId : 0,
    pages,
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
  }
}

/**
 * PATCH /api/admin/bloqueio-pagina/toggle-page
 * Body: `{ workspace_id, profile_id, page, enabled }`
 *
 * - Sem linha em `page_roles`: cria com `workspace_id` + `profile_id`.
 * - `enabled: true`: adiciona `page` em `pages`.
 * - `enabled: false`: remove `page` de `pages`.
 */
export default defineEventHandler(async (event): Promise<AdminBloqueioTogglePageResponse> => {
  assertMethod(event, 'PATCH')

  await requireAdminUser(event)

  const body = await readBody<AdminBloqueioTogglePageBody>(event)
  const workspaceId = parseWorkspaceId(body?.workspace_id)
  const profileId = parseProfileId(body?.profile_id)
  const page = parsePageSlug(body?.page)
  const enabled = parseEnabled(body?.enabled)

  await assertAdminWorkspaceAtivo(event, workspaceId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: profileRow, error: profileErr } = await admin
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .maybeSingle()

  if (profileErr) {
    throw createError({ statusCode: 500, statusMessage: profileErr.message })
  }

  if (!profileRow) {
    throw createError({ statusCode: 404, statusMessage: 'Profile não encontrado.' })
  }

  const { data: existing, error: existingErr } = await admin
    .from('page_roles')
    .select('id, workspace_id, profile_id, pages, created_at, updated_at')
    .eq('workspace_id', workspaceId)
    .eq('profile_id', profileId)
    .maybeSingle()

  if (existingErr) {
    throw createError({ statusCode: 500, statusMessage: existingErr.message })
  }

  const pagesAtuais = Array.isArray((existing as { pages?: unknown } | null)?.pages)
    ? ((existing as { pages: unknown[] }).pages as unknown[])
        .map((p) => String(p ?? '').trim())
        .filter(Boolean)
    : []

  const set = new Set(pagesAtuais)
  if (enabled) set.add(page)
  else set.delete(page)

  const pages = [...set]

  if (!existing) {
    const { data, error } = await admin
      .from('page_roles')
      .insert({
        workspace_id: workspaceId,
        profile_id: profileId,
        pages,
      })
      .select('id, workspace_id, profile_id, pages, created_at, updated_at')
      .single()

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message })
    }

    return { row: mapPageRoleRow(data as Record<string, unknown>) }
  }

  const existingId =
    typeof (existing as { id?: unknown }).id === 'number'
      ? (existing as { id: number }).id
      : Number((existing as { id?: unknown }).id)

  const { data, error } = await admin
    .from('page_roles')
    .update({ pages })
    .eq('id', existingId)
    .eq('workspace_id', workspaceId)
    .eq('profile_id', profileId)
    .select('id, workspace_id, profile_id, pages, created_at, updated_at')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return { row: mapPageRoleRow(data as Record<string, unknown>) }
})
