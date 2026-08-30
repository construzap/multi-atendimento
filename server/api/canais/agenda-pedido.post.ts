import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import { checkChannel } from '../../utils/checkChannel'
import { getAuthUserId } from '../../utils/getAuthUserId'

type Body = {
  workspace_id?: unknown
  id_canal?: unknown
  agenda_pedido?: unknown
}

function toInt(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  return n
}

/**
 * POST /api/canais/agenda-pedido
 * Body: `{ workspace_id, id_canal, agenda_pedido }`
 *
 * Atualiza só `canais.agenda_pedido` (atendente do workspace com acesso ao canal).
 */
export default defineEventHandler(
  async (event): Promise<{ ok: true; id: number; agenda_pedido: boolean }> => {
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

    const workspaceId = toInt(body.workspace_id)
    if (!workspaceId) {
      throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
    }

    const canalId = toInt(body.id_canal)
    if (!canalId) {
      throw createError({ statusCode: 400, statusMessage: 'id_canal inválido.' })
    }

    if (typeof body.agenda_pedido !== 'boolean') {
      throw createError({ statusCode: 400, statusMessage: 'agenda_pedido inválido.' })
    }
    const agendaPedido = body.agenda_pedido

    const owns = await checkChannel(event, canalId, userId)
    if (!owns) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Canal não encontrado ou você não tem permissão para editá-lo.',
      })
    }

    const admin = serverSupabaseServiceRole<any>(event)

    const { data, error } = await admin
      .from('canais')
      .update({ agenda_pedido: agendaPedido })
      .eq('id', canalId)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .is('deleted_by', null)
      .select('id, agenda_pedido')
      .maybeSingle()

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message })
    }

    if (!data) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Canal não encontrado neste workspace ou foi removido.',
      })
    }

    const id = typeof data.id === 'number' ? data.id : Number(data.id)
    return {
      ok: true,
      id: Math.trunc(id),
      agenda_pedido: data.agenda_pedido === true,
    }
  },
)
