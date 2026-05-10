import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type { AtendentesListResponse } from '#shared/types/atendentes'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

/**
 * GET /api/atendentes?workspace_id=
 *
 * Lista atendentes via `view_atendentes` (id, nome, e-mail, atendente_user_id).
 * Inclui `sou_dono_workspace` para a UI saber se pode excluir/atribuir gestão.
 */
export default defineEventHandler(async (event): Promise<AtendentesListResponse> => {
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
  const rawWs = q.workspace_id
  if (rawWs === undefined || rawWs === null || rawWs === '') {
    throw createError({ statusCode: 400, statusMessage: 'Informe workspace_id na query.' })
  }

  const workspaceId =
    typeof rawWs === 'number' ? rawWs : Number.parseInt(String(rawWs), 10)
  if (!Number.isFinite(workspaceId) || !Number.isInteger(workspaceId) || workspaceId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: wsRow, error: wsErr } = await admin
    .from('workspace')
    .select('user_id')
    .eq('id', workspaceId)
    .is('deleted_at', null)
    .is('deleted_by', null)
    .maybeSingle()

  if (wsErr) {
    throw createError({ statusCode: 500, statusMessage: wsErr.message })
  }

  const rawOwner = (wsRow as { user_id?: unknown } | null)?.user_id
  const ownerId =
    typeof rawOwner === 'string' ? rawOwner : rawOwner != null ? String(rawOwner) : ''
  const souDonoWorkspace = Boolean(ownerId && ownerId === userId)

  const { data, error } = await admin
    .from('view_atendentes')
    .select('id, atendente_user_id, full_name, email')
    .eq('workspace_id', workspaceId)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const rows = (data ?? []) as Array<{
    id?: unknown
    atendente_user_id?: unknown
    full_name?: unknown
    email?: unknown
  }>

  const mapped = rows.map((r) => {
    const idNum = typeof r.id === 'number' ? r.id : Number(r.id)
    const uidRaw = r.atendente_user_id
    const atendenteUserId =
      typeof uidRaw === 'string' ? uidRaw : uidRaw != null ? String(uidRaw) : ''

    return {
      id: Number.isFinite(idNum) && Number.isInteger(idNum) ? idNum : 0,
      nome: r.full_name != null ? String(r.full_name).trim() || null : null,
      email: r.email != null ? String(r.email).trim() || null : null,
      atendente_user_id: atendenteUserId,
    }
  })

  return {
    sou_dono_workspace: souDonoWorkspace,
    data: mapped.filter((x) => x.id > 0 && x.atendente_user_id.length > 0),
  }
})
