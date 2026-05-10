import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type { Contato, ContatosListResponse } from '#shared/types/contato'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

const SELECT = 'key, name, created_at, updated_at, photo, id_canal, phone, lid'

/**
 * GET /api/contatos?workspace_id=
 *
 * Retorna contatos a partir da tabela `conversas` (campos básicos),
 * filtrando por todos os canais ativos do workspace.
 */
export default defineEventHandler(async (event): Promise<ContatosListResponse> => {
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

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: canaisRows, error: canaisErr } = await admin
    .from('canais')
    .select('id')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .is('deleted_by', null)

  if (canaisErr) {
    throw createError({ statusCode: 500, statusMessage: canaisErr.message })
  }

  const canalIds = (canaisRows ?? [])
    .map((r: any) => (typeof r.id === 'number' ? r.id : Number(r.id)))
    .filter((n: number) => Number.isFinite(n) && n > 0)

  if (!canalIds.length) {
    return { data: [] }
  }

  const { data, error } = await admin
    .from('conversas')
    .select(SELECT)
    .in('id_canal', canalIds)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return { data: (data ?? []) as Contato[] }
})
