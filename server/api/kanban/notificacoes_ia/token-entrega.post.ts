import { randomUUID } from 'node:crypto'
import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { getAuthUserId } from '../../../utils/getAuthUserId'

type Body = {
  workspace_id?: unknown
  id?: unknown
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
 * POST /api/kanban/notificacoes_ia/token-entrega
 * Body: `{ workspace_id, id }`
 * Garante `token_entrega` (UUID). Se já existir, devolve o atual.
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

  const body = (await readBody(event)) as Body
  const workspaceId = parsePositiveInt(body.workspace_id, 'workspace_id')
  const id = parsePositiveInt(body.id, 'id')

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: row, error: findErr } = await admin
    .from('notificacoes_ia')
    .select('id, workspace_id, token_entrega')
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

  const existente =
    row.token_entrega != null && String(row.token_entrega).trim()
      ? String(row.token_entrega).trim().toLowerCase()
      : null

  if (existente) {
    return {
      ok: true as const,
      id,
      token_entrega: existente,
      created: false as const,
    }
  }

  const token = randomUUID()
  const nowIso = new Date().toISOString()

  const { data: updated, error: updErr } = await admin
    .from('notificacoes_ia')
    .update({
      token_entrega: token,
      updated_at: nowIso,
    })
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .is('token_entrega', null)
    .select('token_entrega')
    .maybeSingle()

  if (updErr) {
    throw createError({ statusCode: 500, statusMessage: updErr.message })
  }

  // Race: outro request pode ter gerado o token entre o select e o update
  if (!updated?.token_entrega) {
    const { data: again, error: againErr } = await admin
      .from('notificacoes_ia')
      .select('token_entrega')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (againErr) {
      throw createError({ statusCode: 500, statusMessage: againErr.message })
    }
    const t = again?.token_entrega != null ? String(again.token_entrega).trim().toLowerCase() : ''
    if (!t) {
      throw createError({ statusCode: 500, statusMessage: 'Não foi possível gerar o token de entrega.' })
    }
    return { ok: true as const, id, token_entrega: t, created: false as const }
  }

  return {
    ok: true as const,
    id,
    token_entrega: String(updated.token_entrega).trim().toLowerCase(),
    created: true as const,
  }
})
