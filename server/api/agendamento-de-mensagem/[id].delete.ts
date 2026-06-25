import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import type { AgendamentoMensagemEliminarResponse } from '#shared/types/agendamentoMensagens'
import { assertMethod, createError, getQuery, getRouterParam } from 'h3'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

function parsePositiveInt(raw: unknown, label: string): number {
  const s = String(raw ?? '').trim()
  if (!s) {
    throw createError({ statusCode: 400, statusMessage: `${label} é obrigatório.` })
  }
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  if (String(n) !== s) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  return n
}

function parseIdAgendamento(raw: string | undefined): number {
  const n = Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'id do agendamento inválido.' })
  }
  return n
}

/**
 * DELETE /api/agendamento-de-mensagem/:id?workspace_id=
 * Remove linha de `agendamentos_mensagens` do workspace (após `checkWorkspace`).
 */
export default defineEventHandler(async (event): Promise<AgendamentoMensagemEliminarResponse> => {
  assertMethod(event, 'DELETE')

  const agendamentoId = parseIdAgendamento(getRouterParam(event, 'id'))

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
  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: existente, error: exErr } = await admin
    .from('agendamentos_mensagens')
    .select('id, workspace_id')
    .eq('id', agendamentoId)
    .maybeSingle()

  if (exErr) {
    throw createError({ statusCode: 500, statusMessage: exErr.message })
  }
  if (!existente) {
    throw createError({ statusCode: 404, statusMessage: 'Agendamento não encontrado.' })
  }

  const wsEx =
    typeof (existente as { workspace_id?: unknown }).workspace_id === 'number'
      ? (existente as { workspace_id: number }).workspace_id
      : Number((existente as { workspace_id?: unknown }).workspace_id)

  if (!Number.isFinite(wsEx) || wsEx !== workspaceId) {
    throw createError({ statusCode: 403, statusMessage: 'Agendamento não pertence a este workspace.' })
  }

  const { data: deletedRows, error: delErr } = await admin
    .from('agendamentos_mensagens')
    .delete()
    .eq('id', agendamentoId)
    .eq('workspace_id', workspaceId)
    .select('id')

  if (delErr) {
    throw createError({ statusCode: 500, statusMessage: delErr.message })
  }

  const deleted = Array.isArray(deletedRows) ? deletedRows[0] : deletedRows
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Não foi possível excluir o agendamento.' })
  }

  return { ok: true }
})
