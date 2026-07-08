import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import type { DetalheWebhookExecucaoResponse } from '#shared/types/webhookExecucao'
import { createError, getQuery, getRouterParam } from 'h3'
import { checkAdmin } from '../../../utils/checkAdmin'
import { getAuthUserId } from '../../../utils/getAuthUserId'
import {
  execucaoPertenceAoWorkspace,
  listarCanalIdsDoWorkspace,
} from '../../../utils/webhookExecucaoAcesso'

function parseWorkspaceId(raw: unknown): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }
  return n
}

/**
 * GET /api/logs/execucoes/:id?workspace_id=
 *
 * Detalhe de uma execução de webhook (somente administradores).
 */
export default defineEventHandler(async (event): Promise<DetalheWebhookExecucaoResponse> => {
  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  await checkAdmin(event, userId)

  const id = getRouterParam(event, 'id')?.trim()
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'id inválido.' })
  }

  const q = getQuery(event)
  const workspaceId = parseWorkspaceId(q.workspace_id)

  const admin = serverSupabaseServiceRole<any>(event)
  const canalIds = await listarCanalIdsDoWorkspace(admin, workspaceId)

  const { data, error } = await admin
    .from('webhook_uazapi_execucoes')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Execução não encontrada.' })
  }

  if (!execucaoPertenceAoWorkspace(data, workspaceId, canalIds)) {
    throw createError({ statusCode: 404, statusMessage: 'Execução não encontrada.' })
  }

  let canal_nome: string | null = null
  const idCanal = data.id_canal != null ? Number(data.id_canal) : null
  if (idCanal != null && Number.isFinite(idCanal)) {
    const { data: canalRow } = await admin
      .from('canais')
      .select('nome')
      .eq('id', idCanal)
      .maybeSingle()
    canal_nome = typeof canalRow?.nome === 'string' ? canalRow.nome : null
  }

  return {
    execucao: {
      ...(data as DetalheWebhookExecucaoResponse['execucao']),
      canal_nome,
    },
  }
})
