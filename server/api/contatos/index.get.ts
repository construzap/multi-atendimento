import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type { Contato, ContatosListResponse } from '#shared/types/contato'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'
import {
  deduplicarContatosPorKey,
  mapViewRowToContato,
} from '../../utils/viewConversasDetalhes'

const PER_PAGE = 20

const VIEW = 'view_kanban_conversas'

/** Sem `mensagens` (histórico pesado); view já exclui `deleted_at`. */
const SELECT =
  'conversa_key, name, created_at, updated_at, id_canal, phone, lid, connect_phone, photo, workspace_id, conversa_aberta, is_group, name_group, ia_ligada, nao_lidas, funil_id, coluna_id, atendente_id, posicao, prioridade, campos_personalizados'

/** Escapa `%` e `_` para uso em padrões `ilike` do PostgREST. */
function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function quotePostgrestFilterValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/**
 * GET /api/contatos?workspace_id=&page=&q=
 *
 * Retorna contatos a partir da view `view_kanban_conversas`, filtrando por `workspace_id`.
 * Paginado (20 por página).
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

  const rawPage = q.page
  const page =
    rawPage === undefined || rawPage === null || rawPage === ''
      ? 1
      : Number.parseInt(String(rawPage), 10)
  if (!Number.isFinite(page) || page < 1 || !Number.isInteger(page)) {
    throw createError({ statusCode: 400, statusMessage: 'page inválido (use inteiro ≥ 1).' })
  }

  const searchRaw = typeof q.q === 'string' ? q.q.trim() : ''

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const from = (page - 1) * PER_PAGE
  const to = from + PER_PAGE - 1

  let query = admin
    .from(VIEW)
    .select(SELECT, { count: 'exact' })
    .eq('workspace_id', workspaceId)

  if (searchRaw.length > 0) {
    const esc = escapeIlike(searchRaw)
    const p = quotePostgrestFilterValue(`%${esc}%`)
    query = query.or(
      `name.ilike.${p},phone.ilike.${p},lid.ilike.${p},connect_phone.ilike.${p},name_group.ilike.${p}`,
    )
  }

  let countQuery = admin
    .from('conversas')
    .select('key', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)

  if (searchRaw.length > 0) {
    const esc = escapeIlike(searchRaw)
    const p = quotePostgrestFilterValue(`%${esc}%`)
    countQuery = countQuery.or(
      `name.ilike.${p},phone.ilike.${p},lid.ilike.${p},connect_phone.ilike.${p},name_group.ilike.${p}`,
    )
  }

  const [{ data, error }, { count, error: countErr }] = await Promise.all([
    query
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(from, to),
    countQuery,
  ])

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  if (countErr) {
    throw createError({ statusCode: 500, statusMessage: countErr.message })
  }

  const mapped = deduplicarContatosPorKey(
    (data ?? []).map((row) => mapViewRowToContato(row as Record<string, unknown>)),
  )

  return {
    data: mapped as Contato[],
    page,
    perPage: PER_PAGE,
    total: count ?? 0,
  }
})
