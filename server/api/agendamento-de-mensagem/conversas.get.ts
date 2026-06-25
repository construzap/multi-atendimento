import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type { AgendamentoDestinatariosListResponse } from '#shared/types/agendamentoMensagens'
import { checkChannel } from '../../utils/checkChannel'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

const PER_PAGE = 20

const SELECT = 'connect_phone, id_canal, lid, name'

function escapeIlike(term: string): string {
  return term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function parsePositiveInt(raw: unknown, field: string): number {
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: `${field} inválido (use inteiro ≥ 1).`,
    })
  }
  return n
}

/**
 * GET /api/agendamento-de-mensagem/conversas?workspace_id=&id_canal=&page=&q=
 * Lista conversas do workspace/canal para escolha de destinatário no agendamento.
 * Paginação de 20 em 20; busca opcional por `name`, `connect_phone` ou `phone`.
 */
export default defineEventHandler(async (event): Promise<AgendamentoDestinatariosListResponse> => {
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

  const q = getQuery(event)
  const workspaceId = parsePositiveInt(q.workspace_id, 'workspace_id')
  await checkWorkspace(event, workspaceId, userId)

  const canalId = parsePositiveInt(q.id_canal, 'id_canal')
  const allowed = await checkChannel(event, canalId, userId)
  if (!allowed) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Canal não encontrado ou sem permissão para acessar as conversas.',
    })
  }

  const rawPage = q.page
  const page =
    rawPage === undefined || rawPage === null || rawPage === ''
      ? 1
      : Number.parseInt(String(rawPage), 10)
  if (!Number.isFinite(page) || page < 1 || !Number.isInteger(page)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'page inválido (use inteiro ≥ 1).',
    })
  }

  const searchRaw = q.q ?? q.search
  const searchTerm =
    searchRaw === undefined || searchRaw === null ? '' : String(searchRaw).trim()

  const from = (page - 1) * PER_PAGE
  const to = from + PER_PAGE - 1

  const admin = serverSupabaseServiceRole<any>(event)
  let query = admin
    .from('conversas')
    .select(SELECT, { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .eq('id_canal', canalId)
    .is('deleted_at', null)

  if (searchTerm) {
    const escaped = escapeIlike(searchTerm)
    const pattern = `%${escaped}%`
    query = query.or(`name.ilike.${pattern},connect_phone.ilike.${pattern},phone.ilike.${pattern}`)
  }

  const { data, error, count } = await query
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    })
  }

  return {
    data: (data ?? []) as AgendamentoDestinatariosListResponse['data'],
    page,
    perPage: PER_PAGE,
    total: count ?? 0,
  }
})
