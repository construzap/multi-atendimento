import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import type { ExcluirCampanhaResponse } from '#shared/types/disparoEmMassa'
import { assertMethod, createError, getQuery } from 'h3'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { getAuthUserId } from '../../../utils/getAuthUserId'

type SupabaseAdmin = ReturnType<typeof serverSupabaseServiceRole<any>>

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

function parseCampanhaId(raw: unknown): string {
  const id = String(raw ?? '').trim()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'campanha_id inválido.' })
  }
  return id
}

async function assertCampanhaDoWorkspace(
  admin: SupabaseAdmin,
  campanhaId: string,
  workspaceId: number,
): Promise<void> {
  const { data: campanha, error } = await admin
    .from('campanhas')
    .select('id, canal_id')
    .eq('id', campanhaId)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  if (!campanha) {
    throw createError({ statusCode: 404, statusMessage: 'Campanha não encontrada.' })
  }

  const canalId =
    typeof campanha.canal_id === 'number'
      ? campanha.canal_id
      : Number.parseInt(String(campanha.canal_id ?? '').trim(), 10)
  if (!Number.isFinite(canalId) || canalId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Campanha sem canal associado.' })
  }

  const { data: canal, error: canalErr } = await admin
    .from('canais')
    .select('workspace_id')
    .eq('id', canalId)
    .is('deleted_at', null)
    .maybeSingle()

  if (canalErr) throw createError({ statusCode: 500, statusMessage: canalErr.message })
  if (!canal) {
    throw createError({ statusCode: 404, statusMessage: 'Canal da campanha não encontrado.' })
  }

  const wsCanal =
    typeof canal.workspace_id === 'number'
      ? canal.workspace_id
      : Number.parseInt(String(canal.workspace_id ?? '').trim(), 10)
  if (!Number.isFinite(wsCanal) || wsCanal !== workspaceId) {
    throw createError({ statusCode: 403, statusMessage: 'Campanha não pertence a este workspace.' })
  }
}

/**
 * DELETE /api/kanban/disparo_em_massa?workspace_id=&campanha_id=
 *
 * Remove fila de disparos e o registro em `campanhas`.
 */
export default defineEventHandler(async (event): Promise<ExcluirCampanhaResponse> => {
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
  const workspaceId = parseWorkspaceId(q.workspace_id)
  const campanhaId = parseCampanhaId(q.campanha_id)

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  await assertCampanhaDoWorkspace(admin, campanhaId, workspaceId)

  const { error: filaErr } = await admin.from('fila_disparos').delete().eq('campanha_id', campanhaId)

  if (filaErr) {
    throw createError({
      statusCode: 500,
      statusMessage: filaErr.message ?? 'Não foi possível remover a fila de disparos.',
    })
  }

  const { error: campanhaErr } = await admin.from('campanhas').delete().eq('id', campanhaId)

  if (campanhaErr) {
    throw createError({
      statusCode: 500,
      statusMessage: campanhaErr.message ?? 'Não foi possível excluir a campanha.',
    })
  }

  return { ok: true, id: campanhaId }
})
