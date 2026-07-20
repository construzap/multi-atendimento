import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import type {
  AlterarStatusCampanhaResponse,
  CampanhaListItem,
  CampanhaStatusCriacao,
} from '#shared/types/disparoEmMassa'
import { assertMethod, createError, readBody } from 'h3'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { getAuthUserId } from '../../../utils/getAuthUserId'

const CAMPANHA_SELECT =
  'id, nome, tipo_mensagem, conteudo_texto, url_midia, intervalo_minimo_minutos, intervalo_maximo_minutos, status, canal_id, canais_ids, data_inicio, total_contatos, total_enviados, proximo_disparo, ia_ligada, visualizacao_unica, hora_permitida_inicio, hora_permitida_fim, fonte_canal_id, envia_para_grupo, coluna_id, funil_id, timezone_escolhido, tamanho_lote, pausa_lote_minutos, coluna_erro_id, funil_erro_id, sequencia_tipos, sequencia_textos, sequencia_midias'

type Body = Record<string, unknown>
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

function parseCampanhaStatus(raw: unknown): CampanhaStatusCriacao {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s === 'rascunho' || s === 'processando') return s
  throw createError({ statusCode: 400, statusMessage: 'status deve ser rascunho ou processando.' })
}

async function campanhaPertenceAoWorkspace(
  admin: SupabaseAdmin,
  campanhaId: string,
  workspaceId: number,
): Promise<{ status: string | null }> {
  const { data: campanha, error } = await admin
    .from('campanhas')
    .select('id, canal_id, status')
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

  return {
    status: campanha.status != null ? String(campanha.status) : null,
  }
}

/**
 * PATCH /api/kanban/disparo_em_massa/status
 *
 * Atualiza apenas o campo `status` da campanha (`rascunho` ou `processando`).
 */
export default defineEventHandler(async (event): Promise<AlterarStatusCampanhaResponse> => {
  assertMethod(event, 'PATCH')

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
  const workspaceId = parseWorkspaceId(body.workspace_id)
  const campanhaId = parseCampanhaId(body.campanha_id)
  const status = parseCampanhaStatus(body.status)

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)
  const existente = await campanhaPertenceAoWorkspace(admin, campanhaId, workspaceId)

  if (existente.status === 'concluido') {
    throw createError({ statusCode: 400, statusMessage: 'Campanha concluída não pode ser alterada.' })
  }

  const { data: campanhaUpdate, error: campanhaErr } = await admin
    .from('campanhas')
    .update({ status })
    .eq('id', campanhaId)
    .select(CAMPANHA_SELECT)
    .single()

  if (campanhaErr || !campanhaUpdate) {
    throw createError({
      statusCode: 500,
      statusMessage: campanhaErr?.message ?? 'Não foi possível alterar o status da campanha.',
    })
  }

  return {
    campanha: campanhaUpdate as CampanhaListItem,
  }
})
