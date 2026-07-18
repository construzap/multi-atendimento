import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type { PageRolesCheckResponse } from '#shared/types/pageRoles'
import { assertPageRole, checkPageRoles } from '../../utils/checkPageRoles'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'
import { parsePositiveInt } from '../../utils/parsePositiveInt'

/**
 * GET /api/page-roles?workspace_id=&profile_id=&page=
 *
 * Retorna as páginas liberadas em `page_roles` para o perfil no workspace.
 * Se `page` for informado, valida o slug via `assertPageRole` (403 se sem permissão).
 * O `profile_id` deve pertencer ao usuário autenticado.
 */
export default defineEventHandler(async (event): Promise<PageRolesCheckResponse> => {
  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const q = getQuery(event)
  const workspaceId = parsePositiveInt(q.workspace_id, 'workspace_id')
  const profileId = parsePositiveInt(q.profile_id, 'profile_id')

  const rawPage = q.page
  const pageSlug =
    rawPage === undefined || rawPage === null || rawPage === ''
      ? null
      : String(Array.isArray(rawPage) ? rawPage[0] : rawPage).trim()

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)
  const { data: profileRow, error: profileErr } = await admin
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .eq('user_id', userId)
    .maybeSingle()

  if (profileErr) {
    throw createError({ statusCode: 500, statusMessage: profileErr.message })
  }

  if (!profileRow) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Perfil inválido para o usuário autenticado.',
    })
  }

  if (pageSlug) {
    return assertPageRole(event, workspaceId, profileId, pageSlug)
  }

  return checkPageRoles(event, workspaceId, profileId)
})
