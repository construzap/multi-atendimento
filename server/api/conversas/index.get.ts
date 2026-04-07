import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type { Conversa, ConversasListResponse } from '#shared/types/conversa'
import { checkChannel } from '../../utils/checkChannel'
import { getAuthUserId } from '../../utils/getAuthUserId'

const PER_PAGE = 20

const SELECT =
  'key, message, messatype, name, created_at, updated_at, id_canal, phone, lid, connect_phone, photo, from_me, media_url'

/**
 * GET /api/conversas?id_canal=&page=
 * Lista mensagens/conversas do canal, paginadas (20 por página), apenas para o dono do canal.
 *
 * Query:
 * - `id_canal` (obrigatório): id do canal em `canais.id`
 * - `page` (opcional, padrão 1): página 1-based
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

  const from = (page - 1) * PER_PAGE
  const to = from + PER_PAGE - 1

  const admin = serverSupabaseServiceRole<any>(event)
  const { data, error, count } = await admin
    .from('conversas')
    .select(SELECT, { count: 'exact' })
    .eq('id_canal', canalId)
    .is('deleted_at', null)
    // Mais recentes primeiro
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message
    })
  }

  return {
    data: (data ?? []) as Conversa[],
    page,
    perPage: PER_PAGE,
    total: count ?? 0
  }
})
