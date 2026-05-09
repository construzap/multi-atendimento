import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import { getAuthUserId } from '../../utils/getAuthUserId'

type Body = {
  workspace_id?: unknown
  conversa_key?: unknown
  coluna_id?: unknown
}

/**
 * POST /api/kanban/mover
 * Body: `{ workspace_id, conversa_key, coluna_id }`
 * Atualiza ou cria linha em `funil_conversa_status`.
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

  const workspaceIdRaw = body.workspace_id
  const workspaceId =
    typeof workspaceIdRaw === 'number'
      ? workspaceIdRaw
      : Number.parseInt(String(workspaceIdRaw ?? ''), 10)
  if (!Number.isFinite(workspaceId) || !Number.isInteger(workspaceId) || workspaceId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }

  const conversaKey =
    typeof body.conversa_key === 'string' ? body.conversa_key.trim() : ''
  if (!conversaKey) {
    throw createError({ statusCode: 400, statusMessage: 'Informe conversa_key.' })
  }

  const colunaIdRaw = body.coluna_id
  const colunaId =
    typeof colunaIdRaw === 'number'
      ? colunaIdRaw
      : Number.parseInt(String(colunaIdRaw ?? ''), 10)
  if (!Number.isFinite(colunaId) || !Number.isInteger(colunaId)) {
    throw createError({ statusCode: 400, statusMessage: 'coluna_id inválido.' })
  }

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: wsRow, error: wsErr } = await admin
    .from('workspace')
    .select('id')
    .eq('id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()

  if (wsErr) throw createError({ statusCode: 500, statusMessage: wsErr.message })
  if (!wsRow) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Workspace não encontrado ou sem permissão.',
    })
  }

  const { data: funil, error: funilErr } = await admin
    .from('funil_workspace')
    .select('id')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (funilErr) throw createError({ statusCode: 500, statusMessage: funilErr.message })
  if (!funil?.id) {
    throw createError({ statusCode: 400, statusMessage: 'Funil não encontrado para este workspace.' })
  }

  const funilId = typeof funil.id === 'number' ? funil.id : Number(funil.id)

  const { data: coluna, error: colErr } = await admin
    .from('funil_workspace_colunas')
    .select('id')
    .eq('id', colunaId)
    .eq('funil_id', funilId)
    .is('deleted_at', null)
    .maybeSingle()

  if (colErr) throw createError({ statusCode: 500, statusMessage: colErr.message })
  if (!coluna) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Coluna inválida ou não pertence ao funil deste workspace.',
    })
  }

  const nowIso = new Date().toISOString()

  const { error: upErr } = await admin.from('funil_conversa_status').upsert(
    {
      conversa_key: conversaKey,
      workspace_id: workspaceId,
      coluna_id: colunaId,
      updated_at: nowIso,
    },
    { onConflict: 'conversa_key' },
  )

  if (upErr) {
    throw createError({ statusCode: 500, statusMessage: upErr.message })
  }

  return { ok: true as const }
})
