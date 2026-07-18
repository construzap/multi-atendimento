import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type { Conversa, ConversasListResponse } from '#shared/types/conversa'
import type { MessageType } from '#shared/types/messageType'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

const PER_PAGE = 20
const VIEW_KANBAN_CONVERSAS = 'view_kanban_conversas'

const VIEW_SELECT =
  'conversa_key, preview, messatype, name, created_at, updated_at, id_canal, phone, lid, connect_phone, photo, from_me, media_url, conversa_aberta, is_group, id_group, name_group, nao_lidas, funil_id, coluna_id, atendente_id, workspace_id'

type ViewKanbanConversaRow = {
  conversa_key: string
  preview: string | null
  messatype: string | null
  name: string | null
  created_at: string | null
  updated_at: string | null
  id_canal: number | null
  phone: string | null
  lid: string | null
  connect_phone: string | null
  photo: string | null
  from_me: boolean | null
  media_url: string | null
  conversa_aberta: boolean | null
  is_group: boolean | null
  id_group: string | null
  name_group: string | null
  nao_lidas: number | null
  funil_id: number | null
  coluna_id: number | null
  atendente_id: number | null
  workspace_id?: number | null
}

function mapViewRowToConversa(row: ViewKanbanConversaRow): Conversa {
  return {
    key: row.conversa_key,
    message: row.preview,
    messatype: (row.messatype ?? null) as MessageType | null,
    name: row.name,
    created_at: row.created_at,
    updated_at: row.updated_at,
    id_canal: row.id_canal,
    phone: row.phone,
    lid: row.lid,
    connect_phone: row.connect_phone,
    photo: row.photo,
    from_me: row.from_me,
    media_url: row.media_url,
    conversa_aberta: row.conversa_aberta,
    is_group: row.is_group,
    id_group: row.id_group,
    name_group: row.name_group,
    nao_lidas: row.nao_lidas ?? 0,
    funil_id: row.funil_id,
    coluna_id: row.coluna_id,
    atendente_id: row.atendente_id,
  }
}

function parseWorkspaceId(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') {
    throw createError({ statusCode: 400, statusMessage: 'Informe workspace_id na query.' })
  }
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }
  return n
}

function parseCanalId(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') {
    throw createError({ statusCode: 400, statusMessage: 'Informe id_canal na query.' })
  }
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'id_canal inválido.' })
  }
  return n
}

function parseSearchTerm(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined
  const q = String(raw).trim()
  return q ? q : undefined
}

/**
 * GET /api/cobranca/conversas?workspace_id=&id_canal=&q=&page=
 *
 * Busca conversas do canal em `view_kanban_conversas`.
 *
 * Query:
 * - `workspace_id` (obrigatório)
 * - `id_canal` (obrigatório)
 * - `q` (opcional): termo em `name` OU `phone` (parcial, case-insensitive)
 * - `page` (opcional, padrão 1)
 *
 * Sempre exclui grupos (`is_group` null/false).
 */
export default defineEventHandler(async (event): Promise<ConversasListResponse> => {
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
  const canalId = parseCanalId(q.id_canal)
  await checkWorkspace(event, workspaceId, userId)

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

  const searchTerm = parseSearchTerm(q.q)
  const from = (page - 1) * PER_PAGE
  const to = from + PER_PAGE - 1

  const admin = serverSupabaseServiceRole<any>(event)

  let query = admin
    .from(VIEW_KANBAN_CONVERSAS)
    .select(VIEW_SELECT, { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .eq('id_canal', canalId)
    .or('is_group.is.null,is_group.eq.false')

  if (searchTerm) {
    const like = `%${searchTerm}%`
    query = query.or(`name.ilike.${like},phone.ilike.${like}`)
  }

  const { data, error, count } = await query
    .order('updated_at', { ascending: false, nullsFirst: false })
    .range(from, to)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const rows = (data ?? []) as ViewKanbanConversaRow[]

  return {
    data: rows.map(mapViewRowToConversa),
    page,
    perPage: PER_PAGE,
    total: count ?? 0,
  }
})
