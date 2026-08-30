import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { getAuthUserId } from '../../../utils/getAuthUserId'

type Body = {
  workspace_id?: unknown
  id?: unknown
  entrega_status?: unknown
}

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
 * PATCH /api/kanban/notificacoes_ia
 * Body: `{ workspace_id, id, entrega_status }`
 * Atualiza `entrega_status` (e `updated_at`) de uma linha em `notificacoes_ia`.
 */
export default defineEventHandler(async (event) => {
  assertMethod(event, 'PATCH')

  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const body = (await readBody(event)) as Body
  const workspaceId = parsePositiveInt(body.workspace_id, 'workspace_id')
  const id = parsePositiveInt(body.id, 'id')
  const entregaStatus = String(body.entrega_status ?? '').trim()
  if (!entregaStatus) {
    throw createError({ statusCode: 400, statusMessage: 'entrega_status inválido.' })
  }

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)
  const nowIso = new Date().toISOString()

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

  const { data: updated, error: updErr } = await admin
    .from('notificacoes_ia')
    .update({
      entrega_status: entregaStatus,
      updated_at: nowIso,
    })
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select('id, entrega_status, updated_at')
    .maybeSingle()

  if (updErr) {
    throw createError({ statusCode: 500, statusMessage: updErr.message })
  }
  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Notificação não encontrada.' })
  }

  return {
    ok: true as const,
    id: typeof updated.id === 'number' ? updated.id : Number(updated.id),
    entrega_status: String(updated.entrega_status ?? entregaStatus),
    updated_at: updated.updated_at != null ? String(updated.updated_at) : nowIso,
  }
})
