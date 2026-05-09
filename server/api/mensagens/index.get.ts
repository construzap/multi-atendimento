import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type { Mensagem, MensagensListResponse } from '#shared/types/mensagem'
import { checkChannel } from '../../utils/checkChannel'
import { getAuthUserId } from '../../utils/getAuthUserId'

const PER_PAGE = 30

const SELECT =
  'message_id, created_at, from_me, message, phone, lid, connected_phone, messagetype, from_api, id_canal, media_url, caption, filename, key_conversa'

function pickQueryStr(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return ''
}

/**
 * GET /api/mensagens?id_canal=&key=&page=
 *
 * **Principal:** `key` — mesmo valor de `public.conversas.key` e `mensagens.key_conversa`.
 * Aliases aceitos: `key_conversa` (mesmo significado).
 *
 * **Legado:** `lid` — só quando não há `key`; mensagens antigas sem `key_conversa` preenchido.
 *
 * Query:
 * - `id_canal` (obrigatório)
 * - `key` ou `key_conversa` (obrigatório salvo uso legado com `lid`)
 * - `lid` (opcional, legado)
 * - `page` (opcional, padrão 1)
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

  /** Nova PK da conversa (`conversas.key`); aceita também o nome `key_conversa` na query. */
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

  const from = (page - 1) * PER_PAGE
  const to = from + PER_PAGE - 1

  const admin = serverSupabaseServiceRole<any>(event)

  let contactName: string | null = null
  let contactPhoto: string | null = null

  if (conversaKey) {
    const { data: convRow, error: convErr } = await admin
      .from('conversas')
      .select('key, name, photo')
      .eq('id_canal', canalId)
      .eq('key', conversaKey)
      .maybeSingle()

    if (convErr) {
      throw createError({ statusCode: 500, statusMessage: convErr.message })
    }
    if (!convRow) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Conversa não encontrada neste canal.',
      })
    }
    contactName = convRow.name ?? null
    contactPhoto = convRow.photo ?? null
  } else if (lidLegacy) {
    const { data: convByLid } = await admin
      .from('conversas')
      .select('key, name, photo')
      .eq('id_canal', canalId)
      .eq('lid', lidLegacy)
      .maybeSingle()

    const c = convByLid as { name: string | null; photo: string | null } | null
    contactName = c?.name ?? null
    contactPhoto = c?.photo ?? null
  }

  let query = admin.from('mensagens').select(SELECT, { count: 'exact' }).eq('id_canal', canalId)

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

  const rows = (data ?? []) as Omit<Mensagem, 'name' | 'photo'>[]
  const enriched: Mensagem[] = rows.map((row) => ({
    ...row,
    name: contactName,
    photo: contactPhoto,
  }))

  return {
    data: enriched,
    page,
    perPage: PER_PAGE,
    total: count ?? 0,
  }
})
