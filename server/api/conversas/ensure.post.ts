import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { Conversa } from '#shared/types/conversa'
import { normalizeWhatsappBr } from '#shared/utils/normalizeWhatsappBr'
import { checkChannel } from '../../utils/checkChannel'
import { getAuthUserId } from '../../utils/getAuthUserId'

type Body = {
  id_canal?: unknown
  telefone?: unknown
}

function toInt(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  return n
}

function normalizeAndValidatePhone(input: unknown): { digits: string; normalized: string } {
  const digits = String(input ?? '').replace(/\D/g, '')
  if (!digits) {
    throw createError({ statusCode: 400, statusMessage: 'Informe o telefone.' })
  }

  // Regra prática para BR: 55 + DDD + (9?) + número
  if (digits.startsWith('55')) {
    if (digits.length !== 12 && digits.length !== 13) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Telefone incompleto. Use DDI+DDD+número (ex: 55 11 9xxxx xxxx).',
      })
    }
  } else {
    // Fora do BR, só exige um mínimo razoável
    if (digits.length < 10) {
      throw createError({ statusCode: 400, statusMessage: 'Telefone incompleto.' })
    }
  }

  const normalized = normalizeWhatsappBr(digits)
  return { digits, normalized }
}

/**
 * POST /api/conversas/ensure
 * Body: `{ id_canal, telefone }`
 *
 * Procura conversa por (id_canal + phone normalizado). Se não existir, cria e retorna.
 */
export default defineEventHandler(async (event): Promise<Conversa> => {
  assertMethod(event, 'POST')

  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const body = (await readBody(event).catch(() => null)) as Body | null
  const canalId = toInt(body?.id_canal)
  if (!canalId) {
    throw createError({ statusCode: 400, statusMessage: 'id_canal inválido.' })
  }

  const allowed = await checkChannel(event, canalId, userId)
  if (!allowed) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Canal não encontrado ou sem permissão.',
    })
  }

  const { normalized } = normalizeAndValidatePhone(body?.telefone)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: existing, error: selErr } = await admin
    .from('conversas')
    .select(
      'key, message, messatype, name, created_at, updated_at, id_canal, phone, lid, connect_phone, photo, from_me, media_url'
    )
    .eq('id_canal', canalId)
    .eq('phone', normalized)
    .is('deleted_at', null)
    .maybeSingle()

  if (selErr) {
    throw createError({ statusCode: 500, statusMessage: selErr.message })
  }

  if (existing) return existing as Conversa

  const key = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`

  const nowIso = new Date().toISOString()

  const row = {
    key,
    id_canal: canalId,
    phone: normalized,
    lid: null,
    name: null,
    photo: null,
    message: null,
    messatype: null,
    connect_phone: null,
    from_me: null,
    media_url: null,
    created_at: nowIso,
    updated_at: nowIso,
  }

  const { data: inserted, error: insErr } = await admin
    .from('conversas')
    .insert(row)
    .select(
      'key, message, messatype, name, created_at, updated_at, id_canal, phone, lid, connect_phone, photo, from_me, media_url'
    )
    .single()

  if (insErr) {
    throw createError({ statusCode: 500, statusMessage: insErr.message })
  }

  return inserted as Conversa
})

