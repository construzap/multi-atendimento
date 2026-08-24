import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type { CanalPagamentoInfo } from '#shared/types/canal'
import { mapCanalPagamentoRow } from '../../../utils/canalPagamento'
import { getAuthUserId } from '../../../utils/getAuthUserId'
import { checkChannel } from '../../../utils/checkChannel'
import { checkWorkspace } from '../../../utils/checkWorkspace'

const SELECT =
  'id, workspace_id, provedor_pagamentos, chave_pix, credenciais_encrypted, taxas_cartao'

/**
 * GET /api/canais/pagamento?workspace_id=&id=
 * Retorna dados de pagamento do canal (sem ciphertext de credenciais).
 */
export default defineEventHandler(async (event): Promise<CanalPagamentoInfo> => {
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

  const rawId = q.id
  if (rawId === undefined || rawId === null || rawId === '') {
    throw createError({ statusCode: 400, statusMessage: 'Informe id (canal) na query.' })
  }
  const canalId =
    typeof rawId === 'number' ? rawId : Number.parseInt(String(rawId), 10)
  if (!Number.isFinite(canalId) || !Number.isInteger(canalId) || canalId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'id (canal) inválido.' })
  }

  await checkWorkspace(event, workspaceId, userId)

  const owns = await checkChannel(event, canalId, userId)
  if (!owns) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Canal não encontrado ou sem permissão.',
    })
  }

  const admin = serverSupabaseServiceRole<any>(event)
  const { data, error } = await admin
    .from('canais')
    .select(SELECT)
    .eq('id', canalId)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .is('deleted_by', null)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Canal não encontrado.' })
  }

  return mapCanalPagamentoRow(data as Record<string, unknown>, canalId, workspaceId)
})
