import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import { getAuthUserId } from '../../utils/getAuthUserId'

type Body = {
  workspace_id?: unknown
  /** PK da linha em `public.atendentes`. */
  atendente_id?: unknown
}

function parsePositiveInt(raw: unknown): number | null {
  const n =
    typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  return n
}

/**
 * POST /api/atendentes/deletar
 * Body: `{ workspace_id, atendente_id }`
 *
 * Somente o **criador** do workspace remove linhas em que `admin_user_id` é ele.
 * Não é permitido remover o próprio vínculo (criador como atendente).
 */
export default defineEventHandler(async (event) => {
  assertMethod(event, 'POST')

  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const body = (await readBody<Body>(event).catch(() => null)) ?? {}
  const workspaceId = parsePositiveInt(body.workspace_id)
  if (!workspaceId) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }

  const atendenteId = parsePositiveInt(body.atendente_id)
  if (!atendenteId) {
    throw createError({ statusCode: 400, statusMessage: 'atendente_id inválido.' })
  }

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
  if (!wsRow) {
    throw createError({ statusCode: 404, statusMessage: 'Workspace não encontrado.' })
  }

  const rawOwner = (wsRow as { user_id?: unknown }).user_id
  const ownerId =
    typeof rawOwner === 'string' ? rawOwner : rawOwner != null ? String(rawOwner) : ''

  if (!ownerId || ownerId !== userId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Apenas o criador do workspace pode remover atendentes.',
    })
  }

  const { data: row, error: rowErr } = await admin
    .from('atendentes')
    .select('id, workspace_id, admin_user_id, atendente_user_id')
    .eq('id', atendenteId)
    .maybeSingle()

  if (rowErr) {
    throw createError({ statusCode: 500, statusMessage: rowErr.message })
  }
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Registro de atendente não encontrado.' })
  }

  const wsRowId =
    typeof (row as { workspace_id?: unknown }).workspace_id === 'number'
      ? (row as { workspace_id: number }).workspace_id
      : Number((row as { workspace_id?: unknown }).workspace_id)

  if (!Number.isFinite(wsRowId) || wsRowId !== workspaceId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Este atendente não pertence ao workspace informado.',
    })
  }

  const rawAdmin = (row as { admin_user_id?: unknown }).admin_user_id
  const adminUid =
    typeof rawAdmin === 'string' ? rawAdmin : rawAdmin != null ? String(rawAdmin) : ''

  if (!adminUid || adminUid !== userId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Você não tem permissão para remover este atendente.',
    })
  }

  const rawAtend = (row as { atendente_user_id?: unknown }).atendente_user_id
  const atendUid =
    typeof rawAtend === 'string' ? rawAtend : rawAtend != null ? String(rawAtend) : ''

  if (atendUid === userId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Você não pode remover a si mesmo da equipe.',
    })
  }

  const { data: deletedRows, error: delErr } = await admin
    .from('atendentes')
    .delete()
    .eq('id', atendenteId)
    .eq('workspace_id', workspaceId)
    .eq('admin_user_id', userId)
    .select('id')

  if (delErr) {
    throw createError({ statusCode: 500, statusMessage: delErr.message })
  }

  const deleted = Array.isArray(deletedRows) ? deletedRows[0] : deletedRows
  if (!deleted) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Não foi possível remover o atendente.',
    })
  }

  return { ok: true as const }
})
