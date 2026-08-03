import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getQuery, readBody } from 'h3'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { getAuthUserId } from '../../../utils/getAuthUserId'

function parsePositiveInt(raw: unknown, label: string): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  return n
}

/**
 * DELETE /api/kanban/notificacoes_ia
 * Body ou query: `{ workspace_id, id }`
 * Remove permanentemente a linha em `notificacoes_ia`.
 */
export default defineEventHandler(async (event) => {
  assertMethod(event, 'DELETE')

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
  let body: Record<string, unknown> = {}
  try {
    const raw = await readBody(event)
    if (raw && typeof raw === 'object') body = raw as Record<string, unknown>
  } catch {
    body = {}
  }

  const workspaceId = parsePositiveInt(
    body.workspace_id ?? q.workspace_id,
    'workspace_id',
  )
  const id = parsePositiveInt(body.id ?? q.id, 'id')

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: row, error: findErr } = await admin
    .from('notificacoes_ia')
    .select('id, workspace_id')
    .eq('id', id)
    .maybeSingle()

  if (findErr) {
    throw createError({ statusCode: 500, statusMessage: findErr.message })
  }
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Notificação não encontrada.' })
  }

  const wsRow =
    typeof row.workspace_id === 'number'
      ? row.workspace_id
      : Number.parseInt(String(row.workspace_id ?? ''), 10)
  if (!Number.isFinite(wsRow) || wsRow !== workspaceId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Esta notificação não pertence ao workspace informado.',
    })
  }

  const { error: delErr } = await admin
    .from('notificacoes_ia')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId)

  if (delErr) {
    throw createError({ statusCode: 500, statusMessage: delErr.message })
  }

  return { ok: true as const, id }
})
