import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type { Conversa, ConversasListResponse } from '#shared/types/conversa'
import { checkChannel } from '../../utils/checkChannel'
import { getAuthUserId } from '../../utils/getAuthUserId'

const PER_PAGE = 20

const SELECT =
  'key, message, messatype, name, created_at, updated_at, id_canal, phone, lid, connect_phone, photo, from_me, media_url, conversa_aberta, is_group, id_group, name_group, nao_lidas'

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

/**
 * GET /api/conversas?id_canal=&page=&conversa_aberta=&is_group=
 * Lista mensagens/conversas do canal, paginadas (20 por página), apenas para o dono do canal.
 *
 * Query:
 * - `id_canal` (obrigatório): id do canal em `canais.id`
 * - `page` (opcional, padrão 1): página 1-based
 * - `conversa_aberta` (opcional): `true` = só abertas (inclui null legado); `false` = só fechadas; omitido = todas
 * - `is_group` (opcional): `false` = só 1:1 (inclui null legado); omitido = todas (inclui grupos)
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

  const from = (page - 1) * PER_PAGE
  const to = from + PER_PAGE - 1

  const admin = serverSupabaseServiceRole<any>(event)
  let query = admin
    .from('conversas')
    .select(SELECT, { count: 'exact' })
    .eq('id_canal', canalId)
    .is('deleted_at', null)

  if (conversaAbertaFilter === true) {
    // Registros legados com null continuam visíveis na lista de abertas.
    query = query.or('conversa_aberta.is.null,conversa_aberta.eq.true')
  } else if (conversaAbertaFilter === false) {
    query = query.eq('conversa_aberta', false)
  }

  if (isGroupFilter === false) {
    // Registros legados com null continuam visíveis como conversas 1:1.
    query = query.or('is_group.is.null,is_group.eq.false')
  } else if (isGroupFilter === true) {
    query = query.eq('is_group', true)
  }

  const { data, error, count } = await query
    // Mais recentes primeiro: conversa atualiza por `updated_at` (não por `created_at`)
    .order('updated_at', { ascending: false, nullsFirst: false })
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
