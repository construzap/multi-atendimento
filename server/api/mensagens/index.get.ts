import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type { Mensagem, MensagensListResponse } from '#shared/types/mensagem'
import { checkChannel } from '../../utils/checkChannel'
import { getAuthUserId } from '../../utils/getAuthUserId'

const PER_PAGE = 30

const SELECT =
  'message_id, created_at, from_me, message, phone, lid, connected_phone, messagetype, from_api, id_canal, media_url, caption, filename'

/**
 * GET /api/mensagens?id_canal=&lid=&page=
 * Lista mensagens do canal + lid, paginadas (30 por página), mais recentes primeiro.
 *
 * Query:
 * - `id_canal` (obrigatório)
 * - `lid` (obrigatório)
 * - `page` (opcional, padrão 1): página 1-based
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

  const rawLid = q.lid
  const lid = typeof rawLid === 'string' ? rawLid.trim() : String(rawLid ?? '').trim()
  if (!lid) {
    throw createError({ statusCode: 400, statusMessage: 'Informe lid na query.' })
  }

  const allowed = await checkChannel(event, canalId, userId)
  if (!allowed) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Canal não encontrado ou sem permissão para acessar as mensagens.'
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
  const { data, error, count } = await admin
    .from('mensagens')
    .select(SELECT, { count: 'exact' })
    .eq('id_canal', canalId)
    .eq('lid', lid)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return {
    data: (data ?? []) as Mensagem[],
    page,
    perPage: PER_PAGE,
    total: count ?? 0
  }
})

