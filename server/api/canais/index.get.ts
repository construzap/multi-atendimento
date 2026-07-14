import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type { Canal } from '#shared/types/canal'
import { getAuthUserId } from '../../utils/getAuthUserId'
import { checkWorkspace } from '../../utils/checkWorkspace'

/**
 * GET /api/canais?workspace_id=
 * Lista canais do workspace para o usuário logado (não deletados).
 * Filtra apenas por workspace_id (sem user_id na query de canais).
 */
export default defineEventHandler(async (event): Promise<Canal[]> => {
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
  const raw = q.workspace_id
  if (raw === undefined || raw === null || raw === '') {
    throw createError({ statusCode: 400, statusMessage: 'Informe workspace_id na query.' })
  }

  const workspaceId =
    typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)

  if (!Number.isFinite(workspaceId) || !Number.isInteger(workspaceId) || workspaceId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data, error } = await admin
    .from('canais')
    .select('id, nome, descricao, provedor, created_at, endereco, latitude, longitude, tempo_aviso_minutos, horarios')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .is('deleted_by', null)
    .order('created_at', { ascending: false })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return (data ?? []) as Canal[]
})
