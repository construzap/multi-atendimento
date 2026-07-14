import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError } from 'h3'
import type { AdminWorkspace } from '#shared/types/admin'
import { checkAdmin } from '../../utils/checkAdmin'
import { getAuthUserId } from '../../utils/getAuthUserId'

/**
 * GET /api/admin/puxawokspaces
 * Lista todos os workspaces ativos (sem soft delete), apenas para administradores.
 */
export default defineEventHandler(async (event): Promise<AdminWorkspace[]> => {
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

  await checkAdmin(event, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data, error } = await admin
    .from('workspace')
    .select('id, nome, descricao, created_at, user_id, limite_produtos')
    .is('deleted_at', null)
    .is('deleted_by', null)
    .order('created_at', { ascending: false })

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    })
  }

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    const limiteRaw = r.limite_produtos
    const limite =
      limiteRaw == null || limiteRaw === ''
        ? null
        : typeof limiteRaw === 'number'
          ? limiteRaw
          : Number.parseInt(String(limiteRaw), 10)

    return {
      id: Number(r.id),
      nome: String(r.nome ?? ''),
      descricao: r.descricao == null ? null : String(r.descricao),
      created_at: String(r.created_at ?? ''),
      user_id: String(r.user_id ?? ''),
      limite_produtos: limite != null && Number.isFinite(limite) ? limite : null,
    } satisfies AdminWorkspace
  })
})
