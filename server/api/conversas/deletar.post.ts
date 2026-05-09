import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import { checkChannel } from '../../utils/checkChannel'
import { getAuthUserId } from '../../utils/getAuthUserId'

/**
 * POST /api/conversas/deletar
 * Body: `{ key: string }` — `conversas.key` (UUID ou chave legada).
 *
 * 1) Confere dono do canal (`checkChannel`).
 * 2) Remove mensagens (`key_conversa` = key; fallback legado por `lid` sem `key_conversa`).
 * 3) Hard delete da linha em `conversas`.
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

  const body = await readBody(event).catch(() => null) as { key?: unknown } | null
  const keyRaw = typeof body?.key === 'string' ? body.key.trim() : ''
  if (!keyRaw) {
    throw createError({ statusCode: 400, statusMessage: 'Informe key no body (chave da conversa).' })
  }

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: row, error: selErr } = await admin
    .from('conversas')
    .select('key, id_canal, lid')
    .eq('key', keyRaw)
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

  const lidVal =
    row && typeof row === 'object' && 'lid' in row && typeof (row as { lid: unknown }).lid === 'string'
      ? (row as { lid: string }).lid.trim()
      : ''

  const { error: delMsgKey } = await admin
    .from('mensagens')
    .delete()
    .eq('id_canal', idCanal)
    .eq('key_conversa', keyRaw)

  if (delMsgKey) {
    throw createError({
      statusCode: 500,
      statusMessage: `Falha ao apagar mensagens: ${delMsgKey.message}`,
    })
  }

  if (lidVal) {
    const { error: delLegacy } = await admin
      .from('mensagens')
      .delete()
      .eq('id_canal', idCanal)
      .eq('lid', lidVal)
      .is('key_conversa', null)

    if (delLegacy) {
      throw createError({
        statusCode: 500,
        statusMessage: `Falha ao apagar mensagens legadas: ${delLegacy.message}`,
      })
    }
  }

  const { data: deletedRows, error: delConvErr } = await admin
    .from('conversas')
    .delete()
    .eq('key', keyRaw)
    .eq('id_canal', idCanal)
    .select('key')

  if (delConvErr) {
    throw createError({ statusCode: 500, statusMessage: delConvErr.message })
  }

  if (!deletedRows?.length) {
    throw createError({ statusCode: 404, statusMessage: 'Conversa não encontrada.' })
  }

  return { ok: true as const, key: keyRaw }
})
