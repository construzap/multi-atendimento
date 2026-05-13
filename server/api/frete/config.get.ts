import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getQuery } from 'h3'
import type { FreteConfigCapacidadeResumo } from '#shared/types/frete'
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

/**
 * GET /api/frete/config?workspace_id=
 *
 * Retorna apenas `id` e `capacidade_caminhao_kg` da linha do workspace, ou `null` nos dois se não houver registro.
 */
export default defineEventHandler(async (event): Promise<FreteConfigCapacidadeResumo> => {
  assertMethod(event, 'GET')

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
  const { data, error } = await admin
    .from('frete_config_workspace')
    .select('id, capacidade_caminhao_kg')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  if (!data) {
    return { id: null, capacidade_caminhao_kg: null }
  }

  const row = data as { id?: unknown; capacidade_caminhao_kg?: unknown }
  const id = typeof row.id === 'number' ? row.id : Number(row.id)
  const kg =
    typeof row.capacidade_caminhao_kg === 'number'
      ? row.capacidade_caminhao_kg
      : Number.parseFloat(String(row.capacidade_caminhao_kg ?? ''))

  return {
    id: Number.isFinite(id) ? id : null,
    capacidade_caminhao_kg: Number.isFinite(kg) ? kg : null,
  }
})
