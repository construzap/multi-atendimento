import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type { Mensagem, MensagensListResponse } from '#shared/types/mensagem'
import type { MessageType } from '#shared/types/messageType'
import { checkChannel } from '../../utils/checkChannel'
import { getAuthUserId } from '../../utils/getAuthUserId'

const PER_PAGE = 30
const VIEW_KANBAN_CONVERSAS = 'view_kanban_conversas'

const SELECT_LEGADO =
  'message_id, created_at, from_me, message, phone, lid, connected_phone, messagetype, from_api, id_canal, media_url, caption, filename, key_conversa, name, replyid'

type MensagemRow = Omit<Mensagem, 'photo' | 'mensagem_citada'> & { name?: string | null }

type ViewKanbanConversaRow = {
  conversa_key: string
  name: string | null
  photo: string | null
  is_group: boolean | null
  id_canal: number | null
  funil_id: number | null
  coluna_id: number | null
  atendente_id: string | null
  mensagens: unknown
}

type HistoricoMensagemRow = {
  message_id?: string | null
  created_at?: string | null
  from_me?: boolean | null
  message?: string | null
  phone?: string | null
  lid?: string | null
  connected_phone?: string | null
  messagetype?: string | null
  from_api?: boolean | null
  id_canal?: number | null
  media_url?: string | null
  caption?: string | null
  filename?: string | null
  name?: string | null
  replyid?: string | null
}

function parseHistoricoMensagens(raw: unknown): HistoricoMensagemRow[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is HistoricoMensagemRow => Boolean(item) && typeof item === 'object')
}

function historicoParaMensagemRow(
  item: HistoricoMensagemRow,
  conversaKey: string,
  canalId: number,
): MensagemRow | null {
  const messageId = typeof item.message_id === 'string' ? item.message_id.trim() : ''
  if (!messageId) return null

  const createdAt =
    typeof item.created_at === 'string' && item.created_at.trim()
      ? item.created_at.trim()
      : new Date(0).toISOString()

  return {
    message_id: messageId,
    created_at: createdAt,
    from_me: item.from_me ?? null,
    message: item.message ?? null,
    phone: item.phone ?? null,
    lid: item.lid ?? null,
    connected_phone: item.connected_phone ?? null,
    messagetype: (item.messagetype ?? null) as MessageType | null,
    from_api: item.from_api ?? null,
    id_canal: item.id_canal ?? canalId,
    media_url: item.media_url ?? null,
    caption: item.caption ?? null,
    filename: item.filename ?? null,
    key_conversa: conversaKey,
    name: item.name ?? null,
    replyid: item.replyid ?? null,
  }
}

function enrichMensagemRow(
  row: MensagemRow,
  conversaIsGroup: boolean,
  contactName: string | null,
  contactPhoto: string | null,
  mensagemCitada?: Mensagem | null,
): Mensagem {
  const rowName = typeof row.name === 'string' && row.name.trim() ? row.name.trim() : null
  return {
    ...row,
    name: conversaIsGroup ? rowName : contactName,
    photo: conversaIsGroup ? null : contactPhoto,
    ...(mensagemCitada ? { mensagem_citada: mensagemCitada } : {}),
  }
}

function pickQueryStr(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return ''
}

function sortCreatedAtDesc(a: MensagemRow, b: MensagemRow): number {
  const ta = new Date(a.created_at).getTime()
  const tb = new Date(b.created_at).getTime()
  return tb - ta
}

function buildCitadasMap(
  rows: MensagemRow[],
  conversaIsGroup: boolean,
  contactName: string | null,
  contactPhoto: string | null,
): Map<string, Mensagem> {
  const map = new Map<string, Mensagem>()
  for (const row of rows) {
    map.set(row.message_id, enrichMensagemRow(row, conversaIsGroup, contactName, contactPhoto))
  }
  return map
}

function enrichRowsComCitadas(
  rows: MensagemRow[],
  conversaIsGroup: boolean,
  contactName: string | null,
  contactPhoto: string | null,
  citadasPorId: Map<string, Mensagem>,
): Mensagem[] {
  return rows.map((row) => {
    const replyKey = typeof row.replyid === 'string' ? row.replyid.trim() : ''
    const mensagemCitada = replyKey ? (citadasPorId.get(replyKey) ?? null) : null
    return enrichMensagemRow(row, conversaIsGroup, contactName, contactPhoto, mensagemCitada)
  })
}

async function fetchMensagensViaView(
  admin: ReturnType<typeof serverSupabaseServiceRole<any>>,
  canalId: number,
  conversaKey: string,
  page: number,
): Promise<MensagensListResponse> {
  const { data: viewRow, error: viewErr } = await admin
    .from(VIEW_KANBAN_CONVERSAS)
    .select('conversa_key, name, photo, is_group, id_canal, funil_id, coluna_id, atendente_id, mensagens')
    .eq('id_canal', canalId)
    .eq('conversa_key', conversaKey)
    .maybeSingle()

  if (viewErr) {
    throw createError({ statusCode: 500, statusMessage: viewErr.message })
  }

  if (!viewRow) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Conversa não encontrada neste canal.',
    })
  }

  const row = viewRow as ViewKanbanConversaRow
  const contactName = row.name ?? null
  const contactPhoto = row.photo ?? null
  const conversaIsGroup = row.is_group === true

  const todasRows = parseHistoricoMensagens(row.mensagens)
    .map((item) => historicoParaMensagemRow(item, conversaKey, canalId))
    .filter((item): item is MensagemRow => item != null)
    .sort(sortCreatedAtDesc)

  const total = todasRows.length
  const from = (page - 1) * PER_PAGE
  const pageRows = todasRows.slice(from, from + PER_PAGE)

  const citadasPorId = buildCitadasMap(todasRows, conversaIsGroup, contactName, contactPhoto)
  const enriched = enrichRowsComCitadas(
    pageRows,
    conversaIsGroup,
    contactName,
    contactPhoto,
    citadasPorId,
  )

  return {
    data: enriched,
    page,
    perPage: PER_PAGE,
    total,
    id_canal: row.id_canal ?? canalId,
    funil_id: row.funil_id ?? null,
    coluna_id: row.coluna_id ?? null,
    atendente_id: row.atendente_id ?? null,
  }
}

async function fetchMensagensLegado(
  admin: ReturnType<typeof serverSupabaseServiceRole<any>>,
  canalId: number,
  conversaKey: string | null,
  lidLegacy: string,
  page: number,
): Promise<MensagensListResponse> {
  let contactName: string | null = null
  let contactPhoto: string | null = null
  let conversaIsGroup = false

  const { data: convByLid } = await admin
    .from('conversas')
    .select('key, name, photo, is_group')
    .eq('id_canal', canalId)
    .eq('lid', lidLegacy)
    .maybeSingle()

  const c = convByLid as { name: string | null; photo: string | null; is_group?: boolean | null } | null
  contactName = c?.name ?? null
  contactPhoto = c?.photo ?? null
  conversaIsGroup = c?.is_group === true

  const from = (page - 1) * PER_PAGE
  const to = from + PER_PAGE - 1

  let query = admin.from('mensagens').select(SELECT_LEGADO, { count: 'exact' }).eq('id_canal', canalId)

  if (conversaKey) {
    query = query.eq('key_conversa', conversaKey)
  } else {
    query = query.eq('lid', lidLegacy)
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const rows = (data ?? []) as MensagemRow[]

  const replyIds = [
    ...new Set(
      rows
        .map((r) => (typeof r.replyid === 'string' ? r.replyid.trim() : ''))
        .filter(Boolean),
    ),
  ]

  const citadasPorId = new Map<string, Mensagem>()

  if (replyIds.length > 0) {
    const { data: citadas, error: citadasErr } = await admin
      .from('mensagens')
      .select(SELECT_LEGADO)
      .in('message_id', replyIds)

    if (citadasErr) {
      throw createError({ statusCode: 500, statusMessage: citadasErr.message })
    }

    for (const citada of (citadas ?? []) as MensagemRow[]) {
      citadasPorId.set(
        citada.message_id,
        enrichMensagemRow(citada, conversaIsGroup, contactName, contactPhoto),
      )
    }
  }

  return {
    data: enrichRowsComCitadas(rows, conversaIsGroup, contactName, contactPhoto, citadasPorId),
    page,
    perPage: PER_PAGE,
    total: count ?? 0,
  }
}

/**
 * GET /api/mensagens?id_canal=&key=&page=
 *
 * **Principal:** `key` — `view_kanban_conversas.conversa_key` (histórico em `mensagens` JSON).
 * Aliases: `key_conversa`.
 *
 * **Legado:** `lid` — consulta direta em `public.mensagens` quando não há `key`.
 */
export default defineEventHandler(async (event): Promise<MensagensListResponse> => {
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

  const rawCanal = q.id_canal
  if (rawCanal === undefined || rawCanal === null || rawCanal === '') {
    throw createError({ statusCode: 400, statusMessage: 'Informe id_canal na query.' })
  }
  const canalId =
    typeof rawCanal === 'number' ? rawCanal : Number.parseInt(String(rawCanal), 10)
  if (!Number.isFinite(canalId) || !Number.isInteger(canalId)) {
    throw createError({ statusCode: 400, statusMessage: 'id_canal inválido.' })
  }

  const conversaKey = pickQueryStr(q.key, q.key_conversa)
  const lidLegacy = pickQueryStr(q.lid)

  if (!conversaKey && !lidLegacy) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe key (ou key_conversa), ou lid apenas para dados legados.',
    })
  }

  const allowed = await checkChannel(event, canalId, userId)
  if (!allowed) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Canal não encontrado ou sem permissão para acessar as mensagens.',
    })
  }

  const rawPage = q.page
  const page =
    rawPage === undefined || rawPage === null || rawPage === ''
      ? 1
      : Number.parseInt(String(rawPage), 10)
  if (!Number.isFinite(page) || page < 1 || !Number.isInteger(page)) {
    throw createError({ statusCode: 400, statusMessage: 'page inválido (use inteiro ≥ 1).' })
  }

  const admin = serverSupabaseServiceRole<any>(event)

  if (conversaKey) {
    return fetchMensagensViaView(admin, canalId, conversaKey, page)
  }

  return fetchMensagensLegado(admin, canalId, null, lidLegacy, page)
})
