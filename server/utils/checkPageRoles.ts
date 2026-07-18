import { serverSupabaseServiceRole } from '#supabase/server'
import { createError } from 'h3'
import type { H3Event } from 'h3'
import { MSG_SEM_PERMISSAO_PAGINA, type PageRoleRow } from '#shared/types/pageRoles'

export { MSG_SEM_PERMISSAO_PAGINA }

/**
 * Lê `public.page_roles` para o par workspace + profile.
 * Retorna a lista de páginas permitidas (ou `[]` se não houver linha).
 */
export async function checkPageRoles(
  event: H3Event,
  workspaceId: number,
  profileId: number,
): Promise<{ pages: string[]; row: PageRoleRow | null }> {
  const admin = serverSupabaseServiceRole<any>(event)

  const { data, error } = await admin
    .from('page_roles')
    .select('id, workspace_id, profile_id, pages, created_at, updated_at')
    .eq('workspace_id', workspaceId)
    .eq('profile_id', profileId)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  if (!data) {
    return { pages: [], row: null }
  }

  const rawPages = (data as { pages?: unknown }).pages
  const pages = Array.isArray(rawPages)
    ? rawPages.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    : []

  return {
    pages,
    row: data as PageRoleRow,
  }
}

/**
 * Garante que o perfil tem acesso ao slug da página.
 * @throws {createError} 403 — sem permissão (mensagem orientando contato com suporte).
 */
export async function assertPageRole(
  event: H3Event,
  workspaceId: number,
  profileId: number,
  pageSlug: string,
): Promise<{ pages: string[]; row: PageRoleRow | null }> {
  const result = await checkPageRoles(event, workspaceId, profileId)
  const slug = String(pageSlug ?? '').trim()

  if (!slug || !result.pages.includes(slug)) {
    throw createError({
      statusCode: 403,
      message: MSG_SEM_PERMISSAO_PAGINA,
      statusMessage: 'Acesso negado',
    })
  }

  return result
}
