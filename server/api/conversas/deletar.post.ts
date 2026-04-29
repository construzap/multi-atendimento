import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import { checkChannel } from '../../utils/checkChannel'
import { getAuthUserId } from '../../utils/getAuthUserId'

/**
 * Extrai `id_canal` e o restante da chave (lid ou fallback) no formato `{id_canal}-{lid}`.
 */
function parseConversaKey(raw: string): { idCanal: number; lidPart: string } | null {
  const s = String(raw).trim()
  const i = s.indexOf('-')
  if (i === -1) return null
  const idCanal = Number.parseInt(s.slice(0, i), 10)
  const lidPart = s.slice(i + 1)
  if (!Number.isFinite(idCanal) || !lidPart) return null
  return { idCanal, lidPart }
}

/**
 * POST /api/conversas/deletar
 * Body: `{ key: string }` — mesma chave que `conversas.key` / `mensagens.activeKey` (ex.: `12-6589117378660`).
 *
 * 1) Confere dono do canal (`checkChannel`).
 * 2) Remove linhas em `mensagens` (`id_canal` + `lid`).
 * 3) Hard delete da linha em `conversas` pela `key`.
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

  const parsed = parseConversaKey(keyRaw)
  if (!parsed) {
    throw createError({ statusCode: 400, statusMessage: 'Chave inválida (use o formato id_canal-lid).' })
  }

  const { idCanal, lidPart } = parsed

  const allowed = await checkChannel(event, idCanal, userId)
  if (!allowed) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Canal não encontrado ou sem permissão.'
    })
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

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Conversa não encontrada.' })
  }

  if (row.id_canal !== idCanal) {
    throw createError({ statusCode: 400, statusMessage: 'Chave inconsistente com o canal.' })
  }

  const lidForMsgs =
    typeof row.lid === 'string' && row.lid.trim()
      ? row.lid.trim()
      : lidPart

  const { error: delMsgErr } = await admin
    .from('mensagens')
    .delete()
    .eq('id_canal', idCanal)
    .eq('lid', lidForMsgs)

  if (delMsgErr) {
    throw createError({
      statusCode: 500,
      statusMessage: `Falha ao apagar mensagens: ${delMsgErr.message}`
    })
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
