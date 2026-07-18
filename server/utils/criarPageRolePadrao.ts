import { serverSupabaseServiceRole } from '#supabase/server'
import { createError } from 'h3'
import type { H3Event } from 'h3'
import { PAGE_ROLES_PADRAO, type PageRoleRow } from '#shared/types/pageRoles'

/**
 * Páginas padrão ao criar workspace/atendente.
 * Fonte única: `PAGE_ROLES_PADRAO` em `shared/types/pageRoles.ts`.
 */
export function getPageRolesPadrao(): string[] {
  return [...PAGE_ROLES_PADRAO]
}

async function resolveProfileIdByUserId(event: H3Event, userId: string): Promise<number> {
  const admin = serverSupabaseServiceRole<any>(event)
  const uid = String(userId ?? '').trim()
  if (!uid) {
    throw createError({ statusCode: 400, statusMessage: 'user_id inválido para page_roles.' })
  }

  const { data, error } = await admin
    .from('profiles')
    .select('id')
    .eq('user_id', uid)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const raw = (data as { id?: unknown } | null)?.id
  const profileId = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10)

  if (!Number.isFinite(profileId) || !Number.isInteger(profileId) || profileId < 1) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Perfil não encontrado para criar page_roles.',
    })
  }

  return profileId
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
 * Cria linha padrão em `page_roles` para o par workspace + usuário.
 * Resolve `profiles.id` a partir do `user_id`.
 * Se a linha já existir (unique), não sobrescreve — retorna a existente.
 */
export async function criarPageRolePadrao(
  event: H3Event,
  workspaceId: number,
  userId: string,
): Promise<PageRoleRow> {
  if (!Number.isFinite(workspaceId) || !Number.isInteger(workspaceId) || workspaceId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido para page_roles.' })
  }

  const profileId = await resolveProfileIdByUserId(event, userId)
  return criarPageRolePadraoPorProfileId(event, workspaceId, profileId)
}

/**
 * Cria linha padrão em `page_roles` quando já se tem `profiles.id`.
 * Se a linha já existir (unique), não sobrescreve — retorna a existente.
 */
export async function criarPageRolePadraoPorProfileId(
  event: H3Event,
  workspaceId: number,
  profileId: number,
): Promise<PageRoleRow> {
  if (!Number.isFinite(workspaceId) || !Number.isInteger(workspaceId) || workspaceId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido para page_roles.' })
  }
  if (!Number.isFinite(profileId) || !Number.isInteger(profileId) || profileId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'profile_id inválido para page_roles.' })
  }

  const admin = serverSupabaseServiceRole<any>(event)
  const pages = getPageRolesPadrao()

  const { data: existing, error: existingErr } = await admin
    .from('page_roles')
    .select('id, workspace_id, profile_id, pages, created_at, updated_at')
    .eq('workspace_id', workspaceId)
    .eq('profile_id', profileId)
    .maybeSingle()

  if (existingErr) {
    throw createError({ statusCode: 500, statusMessage: existingErr.message })
  }

  if (existing) {
    return mapPageRoleRow(existing as Record<string, unknown>)
  }

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
    // Corrida com unique: outro insert ganhou — lê de novo
    if (error.code === '23505') {
      const { data: again, error: againErr } = await admin
        .from('page_roles')
        .select('id, workspace_id, profile_id, pages, created_at, updated_at')
        .eq('workspace_id', workspaceId)
        .eq('profile_id', profileId)
        .maybeSingle()

      if (againErr) {
        throw createError({ statusCode: 500, statusMessage: againErr.message })
      }
      if (again) {
        return mapPageRoleRow(again as Record<string, unknown>)
      }
    }
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return mapPageRoleRow(data as Record<string, unknown>)
}
