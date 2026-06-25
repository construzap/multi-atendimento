import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import { checkChannel } from '../../utils/checkChannel'
import { getAuthUserId } from '../../utils/getAuthUserId'

/**
 * POST /api/conversas/marcar-lidas
 * Body: `{ key: string }` — zera `nao_lidas` da conversa.
 */
export default defineEventHandler(async (event) => {
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

  const body = (await readBody(event).catch(() => null)) as { key?: unknown } | null
  const keyRaw = typeof body?.key === 'string' ? body.key.trim() : ''
  if (!keyRaw) {
    throw createError({ statusCode: 400, statusMessage: 'Informe key no body (chave da conversa).' })
  }

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: row, error: selErr } = await admin
    .from('conversas')
    .select('key, id_canal')
    .eq('key', keyRaw)
    .is('deleted_at', null)
    .maybeSingle()

  if (selErr) {
    throw createError({ statusCode: 500, statusMessage: selErr.message })
  }

  if (!row || typeof row !== 'object') {
    throw createError({ statusCode: 404, statusMessage: 'Conversa não encontrada.' })
  }

  const idCanal =
    row && typeof row === 'object' && 'id_canal' in row && typeof (row as { id_canal: unknown }).id_canal === 'number'
      ? (row as { id_canal: number }).id_canal
      : null

  if (idCanal == null || !Number.isFinite(idCanal)) {
    throw createError({ statusCode: 400, statusMessage: 'Conversa sem id_canal válido.' })
  }

  const allowed = await checkChannel(event, idCanal, userId)
  if (!allowed) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Canal não encontrado ou sem permissão.',
    })
  }

  const nowIso = new Date().toISOString()

  const { data: updated, error: updErr } = await admin
    .from('conversas')
    .update({ nao_lidas: 0, updated_at: nowIso })
    .eq('key', keyRaw)
    .eq('id_canal', idCanal)
    .select('key, nao_lidas')
    .maybeSingle()

  if (updErr) {
    throw createError({ statusCode: 500, statusMessage: updErr.message })
  }

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Conversa não encontrada.' })
  }

  return { ok: true as const, key: keyRaw, nao_lidas: 0 }
})
