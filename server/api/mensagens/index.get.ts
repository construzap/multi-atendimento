import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type { Mensagem, MensagensListResponse } from '#shared/types/mensagem'
import type { MessageType } from '#shared/types/messageType'
import { checkChannel } from '../../utils/checkChannel'
import { getAuthUserId } from '../../utils/getAuthUserId'

const PER_PAGE = 30

const SELECT_MENSAGENS =
  'message_id, created_at, from_me, message, phone, lid, connected_phone, messagetype, from_api, id_canal, media_url, caption, filename, key_conversa, name, replyid'

type MensagemRow = Omit<Mensagem, 'photo' | 'mensagem_citada'> & { name?: string | null }

type ConversaMeta = {
  key: string
  name: string | null
  photo: string | null
  is_group: boolean | null
  id_canal: number | null
  funil_id: number | null
  coluna_id: number | null
  atendente_id: string | null
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
    messagetype: (row.messagetype ?? null) as MessageType | null,
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

async function carregarCitadas(
  admin: ReturnType<typeof serverSupabaseServiceRole<any>>,
  replyIds: string[],
  conversaIsGroup: boolean,
  contactName: string | null,
  contactPhoto: string | null,
): Promise<Map<string, Mensagem>> {
  const citadasPorId = new Map<string, Mensagem>()
  if (!replyIds.length) return citadasPorId

  const { data: citadas, error: citadasErr } = await admin
    .from('mensagens')
    .select(SELECT_MENSAGENS)
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

  return citadasPorId
}

/**
 * Busca mensagens em `public.mensagens` por `key_conversa` (+ `id_canal`).
 * Metadados da conversa vêm de `public.conversas`.
 */
async function fetchMensagensPorKey(
  admin: ReturnType<typeof serverSupabaseServiceRole<any>>,
  canalId: number,
  conversaKey: string,
  page: number,
): Promise<MensagensListResponse> {
  const { data: convRaw, error: convErr } = await admin
    .from('conversas')
    .select('key, name, photo, is_group, id_canal, funil_id, coluna_id, atendente_id')
    .eq('id_canal', canalId)
    .eq('key', conversaKey)
    .is('deleted_at', null)
    .maybeSingle()

  if (convErr) {
    throw createError({ statusCode: 500, statusMessage: convErr.message })
  }
  if (!convRaw) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Conversa não encontrada neste canal.',
    })
  }

  const conv = convRaw as ConversaMeta
  const contactName = conv.name ?? null
  const contactPhoto = conv.photo ?? null
  const conversaIsGroup = conv.is_group === true

  const from = (page - 1) * PER_PAGE
  const to = from + PER_PAGE - 1

  const { data, error, count } = await admin
    .from('mensagens')
    .select(SELECT_MENSAGENS, { count: 'exact' })
    .eq('id_canal', canalId)
    .eq('key_conversa', conversaKey)
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

  const citadasPorId = await carregarCitadas(
    admin,
    replyIds,
    conversaIsGroup,
    contactName,
    contactPhoto,
  )

  const atendenteRaw = conv.atendente_id
  const atendente_id =
    atendenteRaw === null || atendenteRaw === undefined
      ? null
      : String(atendenteRaw).trim() || null

  return {
    data: enrichRowsComCitadas(rows, conversaIsGroup, contactName, contactPhoto, citadasPorId),
    page,
    perPage: PER_PAGE,
    total: count ?? 0,
    id_canal: conv.id_canal ?? canalId,
    funil_id: conv.funil_id ?? null,
    coluna_id: conv.coluna_id ?? null,
    atendente_id,
  }
}

/** Legado: sem `key`, filtra `mensagens` por `lid`. */
async function fetchMensagensLegado(
  admin: ReturnType<typeof serverSupabaseServiceRole<any>>,
  canalId: number,
  lidLegacy: string,
  page: number,
): Promise<MensagensListResponse> {
  const { data: convByLid } = await admin
    .from('conversas')
    .select('key, name, photo, is_group')
    .eq('id_canal', canalId)
    .eq('lid', lidLegacy)
    .is('deleted_at', null)
    .maybeSingle()

  const c = convByLid as {
    key?: string | null
    name: string | null
    photo: string | null
    is_group?: boolean | null
  } | null
  const contactName = c?.name ?? null
  const contactPhoto = c?.photo ?? null
  const conversaIsGroup = c?.is_group === true
  const conversaKey = typeof c?.key === 'string' ? c.key.trim() : ''

  const from = (page - 1) * PER_PAGE
  const to = from + PER_PAGE - 1

  let query = admin.from('mensagens').select(SELECT_MENSAGENS, { count: 'exact' }).eq('id_canal', canalId)

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

  const citadasPorId = await carregarCitadas(
    admin,
    replyIds,
    conversaIsGroup,
    contactName,
    contactPhoto,
  )

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
 * **Principal:** `key` / `key_conversa` — tabela `public.mensagens` filtrada por `key_conversa`.
 * Metadados da conversa em `public.conversas`.
 *
 * **Legado:** `lid` — quando não há `key`.
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
    return fetchMensagensPorKey(admin, canalId, conversaKey, page)
  }

  return fetchMensagensLegado(admin, canalId, lidLegacy, page)
})
