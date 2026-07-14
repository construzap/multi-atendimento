import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError } from 'h3'
import type { Workspace } from '#shared/types/workspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

/**
 * GET /api/workspaces
 * Lista workspaces em que o usuário logado é atendente (`atendentes.atendente_user_id`).
 *
 * 1. Busca `workspace_id` em `atendentes` para o usuário.
 * 2. Carrega as linhas em `workspace` para esses ids (ativos, sem soft delete).
 * - Consulta via service role (tabela com RLS)
 */
export default defineEventHandler(async (event): Promise<Workspace[]> => {
  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Não autenticado',
    })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Não autenticado',
    })
  }

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: atendRows, error: atendErr } = await admin
    .from('atendentes')
    .select('workspace_id')
    .eq('atendente_user_id', userId)

  if (atendErr) {
    throw createError({
      statusCode: 500,
      statusMessage: atendErr.message,
    })
  }

  const idSet = new Set<number>()
  for (const row of atendRows ?? []) {
    const w =
      row && typeof row === 'object' && 'workspace_id' in row
        ? (row as { workspace_id: unknown }).workspace_id
        : null
    const n = typeof w === 'number' ? w : w != null ? Number(w) : NaN
    if (Number.isFinite(n) && Number.isInteger(n) && n > 0) {
      idSet.add(n)
    }
  }

  const workspaceIds = [...idSet]
  if (!workspaceIds.length) {
    return []
  }

  const { data, error } = await admin
    .from('workspace')
    .select('id, nome, descricao, limite_produtos, created_at')
    .in('id', workspaceIds)
    .is('deleted_by', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    })
  }

  return (data ?? []) as Workspace[]
})
