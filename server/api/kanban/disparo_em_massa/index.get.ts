import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import type { CampanhaListItem, ListarCampanhasResponse } from '#shared/types/disparoEmMassa'
import { createError, getQuery } from 'h3'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { getAuthUserId } from '../../../utils/getAuthUserId'

const CAMPANHAS_SELECT =
  'id, nome, tipo_mensagem, conteudo_texto, url_midia, intervalo_minimo_minutos, intervalo_maximo_minutos, status, canal_id, canais_ids, data_inicio, total_contatos, total_enviados, proximo_disparo, ia_ligada, visualizacao_unica, hora_permitida_inicio, hora_permitida_fim, fonte_canal_id, envia_para_grupo, coluna_id, funil_id, timezone_escolhido, tamanho_lote, pausa_lote_minutos, coluna_erro_id, funil_erro_id'

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
 * GET /api/kanban/disparo_em_massa?workspace_id=
 *
 * Lista campanhas dos canais do workspace (campos resumidos).
 */
export default defineEventHandler(async (event): Promise<ListarCampanhasResponse> => {
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
    .map((row: { id?: unknown }) => {
      const id = typeof row.id === 'number' ? row.id : Number(row.id)
      return Number.isFinite(id) && Number.isInteger(id) && id > 0 ? id : null
    })
    .filter((id): id is number => id != null)

  if (canalIds.length === 0) {
    return { campanhas: [] }
  }

  const { data, error } = await admin
    .from('campanhas')
    .select(CAMPANHAS_SELECT)
    .in('canal_id', canalIds)
    .order('data_inicio', { ascending: false })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return {
    campanhas: (data ?? []) as CampanhaListItem[],
  }
})
