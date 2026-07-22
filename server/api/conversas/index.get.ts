import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type { Conversa, ConversasListResponse } from '#shared/types/conversa'
import type { MessageType } from '#shared/types/messageType'
import { checkChannel } from '../../utils/checkChannel'
import { getAuthUserId } from '../../utils/getAuthUserId'

const PER_PAGE = 20
const PER_PAGE_BUSCA = 10
const VIEW_KANBAN_CONVERSAS = 'view_kanban_conversas'

const VIEW_SELECT =
  'conversa_key, preview, messatype, name, created_at, updated_at, id_canal, phone, lid, connect_phone, photo, from_me, media_url, conversa_aberta, is_group, id_group, name_group, nao_lidas, funil_id, coluna_id, atendente_id, ia_ligada'

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
  ia_ligada: boolean | null
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
    ia_ligada: row.ia_ligada === true ? true : row.ia_ligada === false ? false : null,
  }
}

function parseConversaAbertaFilter(raw: unknown): boolean | null | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined
  const s = String(raw).trim().toLowerCase()
  if (s === 'true' || s === '1') return true
  if (s === 'false' || s === '0') return false
  throw createError({
    statusCode: 400,
    statusMessage: 'conversa_aberta inválido (use true ou false).'
  })
}

function parseIsGroupFilter(raw: unknown): boolean | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined
  const s = String(raw).trim().toLowerCase()
  if (s === 'false' || s === '0') return false
  if (s === 'true' || s === '1') return true
  throw createError({
    statusCode: 400,
    statusMessage: 'is_group inválido (use true ou false).'
  })
}

function parseColunaIdFilter(raw: unknown): number | null | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'coluna_id inválido (use inteiro ≥ 1).'
    })
  }
  return n
}

function parseSearchTerm(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined
  const q = String(raw).trim()
  return q ? q : undefined
}

/**
 * GET /api/conversas?id_canal=&page=&conversa_aberta=&is_group=
 * Lista conversas do canal via `view_kanban_conversas`, paginadas
 * (20 por página na lista; 10 na busca com `q`).
 *
 * Query:
 * - `id_canal` (obrigatório): id do canal em `canais.id`
 * - `page` (opcional, padrão 1): página 1-based
 * - `conversa_aberta` (opcional): `true` = só abertas (inclui null legado); `false` = só fechadas; omitido = todas
 * - `is_group` (opcional): `false` = só 1:1 (inclui null legado); omitido = todas (inclui grupos)
 * - `coluna_id` (opcional): restringe à coluna específica do kanban
 * - `q` (opcional): termo de busca em `name` OU `phone` (parcial, case-insensitive)
 * - `key` (opcional): busca uma conversa específica por `conversa_key` (ignora paginação/filtros)
 */
export default defineEventHandler(async (event): Promise<ConversasListResponse> => {
  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Não autenticado'
    })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Não autenticado'
    })
  }
  const q = getQuery(event)
  const rawCanal = q.id_canal
  if (rawCanal === undefined || rawCanal === null || rawCanal === '') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe id_canal na query.'
    })
  }

  const canalId =
    typeof rawCanal === 'number' ? rawCanal : Number.parseInt(String(rawCanal), 10)
  if (!Number.isFinite(canalId) || !Number.isInteger(canalId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'id_canal inválido.'
    })
  }

  const allowed = await checkChannel(event, canalId, userId)
  if (!allowed) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Canal não encontrado ou sem permissão para acessar as conversas.'
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
      statusMessage: 'page inválido (use inteiro ≥ 1).'
    })
  }

  const conversaAbertaFilter = parseConversaAbertaFilter(q.conversa_aberta)
  const isGroupFilter = parseIsGroupFilter(q.is_group)
  const colunaIdFilter = parseColunaIdFilter(q.coluna_id)
  const searchTerm = parseSearchTerm(q.q)
  const rawKey = q.key
  const conversaKeyFilter =
    rawKey === undefined || rawKey === null || rawKey === ''
      ? undefined
      : String(rawKey).trim() || undefined

  const admin = serverSupabaseServiceRole<any>(event)

  if (conversaKeyFilter) {
    const { data, error } = await admin
      .from(VIEW_KANBAN_CONVERSAS)
      .select(VIEW_SELECT)
      .eq('id_canal', canalId)
      .eq('conversa_key', conversaKeyFilter)
      .maybeSingle()

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: error.message
      })
    }

    const row = data as ViewKanbanConversaRow | null
    return {
      data: row ? [mapViewRowToConversa(row)] : [],
      page: 1,
      perPage: 1,
      total: row ? 1 : 0
    }
  }

  const perPage = searchTerm ? PER_PAGE_BUSCA : PER_PAGE
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  let query = admin
    .from(VIEW_KANBAN_CONVERSAS)
    .select(VIEW_SELECT, { count: 'exact' })
    .eq('id_canal', canalId)

  if (conversaAbertaFilter === true) {
    query = query.or('conversa_aberta.is.null,conversa_aberta.eq.true')
  } else if (conversaAbertaFilter === false) {
    query = query.eq('conversa_aberta', false)
  }

  if (isGroupFilter === false) {
    query = query.or('is_group.is.null,is_group.eq.false')
  } else if (isGroupFilter === true) {
    query = query.eq('is_group', true)
  }

  if (colunaIdFilter != null) {
    query = query.eq('coluna_id', colunaIdFilter)
  }

  if (searchTerm) {
    // Busca parcial (case-insensitive) em name ou phone.
    const like = `%${searchTerm}%`
    query = query.or(`name.ilike.${like},phone.ilike.${like}`)
  }

  const { data, error, count } = await query
    .order('updated_at', { ascending: false, nullsFirst: false })
    .range(from, to)

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message
    })
  }

  const rows = (data ?? []) as ViewKanbanConversaRow[]

  return {
    data: rows.map(mapViewRowToConversa),
    page,
    perPage,
    total: count ?? 0
  }
})
