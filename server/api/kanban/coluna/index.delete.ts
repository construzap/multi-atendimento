import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getQuery } from 'h3'
import { getAuthUserId } from '../../../utils/getAuthUserId'
import { checkWorkspace } from '../../../utils/checkWorkspace'

/**
 * DELETE /api/kanban/coluna?workspace_id=&coluna_id=
 * Soft-delete (`deleted_at`) e renumera `ordem` das colunas ativas do funil (1..n).
 * Bloqueia se existir conversa em `conversas` com `coluna_id` desta coluna neste workspace.
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
  const workspaceIdRaw = q.workspace_id
  const workspaceId =
    typeof workspaceIdRaw === 'number'
      ? workspaceIdRaw
      : Number.parseInt(String(workspaceIdRaw ?? ''), 10)
  if (!Number.isFinite(workspaceId) || !Number.isInteger(workspaceId) || workspaceId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }

  const colunaIdRaw = q.coluna_id
  const colunaId =
    typeof colunaIdRaw === 'number'
      ? colunaIdRaw
      : Number.parseInt(String(colunaIdRaw ?? ''), 10)
  if (!Number.isFinite(colunaId) || !Number.isInteger(colunaId) || colunaId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'coluna_id inválido.' })
  }

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: coluna, error: colErr } = await admin
    .from('funil_workspace_colunas')
    .select('id, funil_id')
    .eq('id', colunaId)
    .is('deleted_at', null)
    .maybeSingle()

  if (colErr) throw createError({ statusCode: 500, statusMessage: colErr.message })
  if (!coluna) {
    throw createError({ statusCode: 404, statusMessage: 'Coluna não encontrada.' })
  }

  const funilId =
    typeof coluna.funil_id === 'number' ? coluna.funil_id : Number(coluna.funil_id)

  const { data: funil, error: funilErr } = await admin
    .from('funil_workspace')
    .select('id, workspace_id')
    .eq('id', funilId)
    .maybeSingle()

  if (funilErr) throw createError({ statusCode: 500, statusMessage: funilErr.message })
  if (!funil) {
    throw createError({ statusCode: 400, statusMessage: 'Funil não encontrado.' })
  }

  const wsFunil =
    typeof funil.workspace_id === 'number'
      ? funil.workspace_id
      : Number(funil.workspace_id)
  if (!Number.isFinite(wsFunil) || wsFunil !== workspaceId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Esta coluna não pertence ao workspace informado.',
    })
  }

  const { data: cardsNaColuna, error: cardsErr } = await admin
    .from('conversas')
    .select('key')
    .eq('workspace_id', workspaceId)
    .eq('coluna_id', colunaId)
    .is('deleted_at', null)
    .limit(1)

  if (cardsErr) throw createError({ statusCode: 500, statusMessage: cardsErr.message })
  if (cardsNaColuna && cardsNaColuna.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'Não é possível excluir esta etapa enquanto houver conversas nela. Mova os cards para outra coluna.',
    })
  }

  const nowIso = new Date().toISOString()

  const { error: delErr } = await admin
    .from('funil_workspace_colunas')
    .update({
      deleted_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', colunaId)

  if (delErr) {
    throw createError({ statusCode: 500, statusMessage: delErr.message })
  }

  const { data: restantes, error: listErr } = await admin
    .from('funil_workspace_colunas')
    .select('id, ordem')
    .eq('funil_id', funilId)
    .is('deleted_at', null)
    .order('ordem', { ascending: true })

  if (listErr) throw createError({ statusCode: 500, statusMessage: listErr.message })

  const rows = restantes ?? []
  for (const [i, row] of rows.entries()) {
    const id =
      typeof row.id === 'number' ? row.id : Number(row.id)
    const novoOrdem = i + 1

    const { error: ordErr } = await admin
      .from('funil_workspace_colunas')
      .update({ ordem: novoOrdem, updated_at: nowIso })
      .eq('id', id)

    if (ordErr) {
      throw createError({ statusCode: 500, statusMessage: ordErr.message })
    }
  }

  return { ok: true as const }
})
