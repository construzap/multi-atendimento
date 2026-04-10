import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, readBody } from 'h3'
import { checkChannel } from '../../utils/checkChannel'
import { getAuthUserId } from '../../utils/getAuthUserId'
import { deleteUazapiInstance } from '../../utils/uazapi'

type Body = {
  id_canal?: number | string
}

/**
 * POST /api/canais/deletarcanal
 * 1) Remove a instância na Uazapi (`DELETE {servidor}/instance`, header `token`).
 *    Só HTTP 200 é aceito; caso contrário aborta (nada é alterado no banco).
 * 2) Soft delete em `canais`: `deleted_at`, `deleted_by`.
 *
 * Body: `id_canal` (obrigatório). Sem `workspace_id`.
 */
export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const body = (await readBody<Body>(event)) ?? {}
  const rawCanal = body.id_canal
  if (rawCanal === undefined || rawCanal === null || rawCanal === '') {
    throw createError({ statusCode: 400, statusMessage: 'Informe id_canal no body.' })
  }

  const canalId = typeof rawCanal === 'number' ? rawCanal : Number.parseInt(String(rawCanal), 10)
  if (!Number.isFinite(canalId) || !Number.isInteger(canalId) || canalId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'id_canal inválido.' })
  }

  const owns = await checkChannel(event, canalId, userId)
  if (!owns) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Canal não encontrado ou você não tem permissão para removê-lo.'
    })
  }

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: canalRow, error: canalErr } = await admin
    .from('canais')
    .select('token, servidor, deleted_at')
    .eq('id', canalId)
    .eq('user_id', userId)
    .maybeSingle()

  if (canalErr) {
    throw createError({ statusCode: 500, statusMessage: canalErr.message })
  }
  if (!canalRow) {
    throw createError({ statusCode: 404, statusMessage: 'Canal não encontrado.' })
  }
  if (canalRow.deleted_at != null) {
    throw createError({ statusCode: 404, statusMessage: 'Canal já foi removido.' })
  }

  const token = typeof canalRow.token === 'string' ? canalRow.token.trim() : ''
  const servidor = typeof canalRow.servidor === 'string' ? canalRow.servidor.trim() : ''

  if (token && servidor) {
    await deleteUazapiInstance(servidor, token)
  }

  const now = new Date().toISOString()

  const { data: updated, error: upErr } = await admin
    .from('canais')
    .update({
      deleted_at: now,
      deleted_by: userId
    })
    .eq('id', canalId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .is('deleted_by', null)
    .select('id')
    .maybeSingle()

  if (upErr) {
    throw createError({ statusCode: 500, statusMessage: upErr.message })
  }
  if (!updated) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Não foi possível concluir a remoção do canal. Tente novamente.'
    })
  }

  return { ok: true as const, id: canalId }
})
