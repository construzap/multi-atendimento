import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, readBody } from 'h3'
import { checkChannel } from '../../utils/checkChannel'
import { getAuthUserId } from '../../utils/getAuthUserId'

type Body = {
  id_canal?: number | string
}

type UazapiDisconnectError = {
  error?: string
}

/**
 * POST /api/canais/desconectar
 * Desconecta a instância (Uazapi) do canal informado.
 *
 * Body:
 * - `id_canal` (obrigatório)
 */
export default defineEventHandler(async (event): Promise<{ response: string }> => {
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
  if (!Number.isFinite(canalId) || !Number.isInteger(canalId)) {
    throw createError({ statusCode: 400, statusMessage: 'id_canal inválido.' })
  }

  const ok = await checkChannel(event, canalId, userId)
  if (!ok) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Você não tem permissão para acessar este canal.'
    })
  }

  // Busca token/servidor somente pelo id do canal (sem filtrar por user_id).
  const admin = serverSupabaseServiceRole<any>(event)
  const { data: canalRow, error: canalErr } = await admin
    .from('canais')
    .select('token, servidor')
    .eq('id', canalId)
    .maybeSingle()

  if (canalErr) {
    throw createError({ statusCode: 500, statusMessage: canalErr.message })
  }
  if (!canalRow) {
    throw createError({ statusCode: 404, statusMessage: 'Canal não encontrado.' })
  }

  const token = typeof canalRow?.token === 'string' ? canalRow.token.trim() : ''
  const servidor = typeof canalRow?.servidor === 'string' ? canalRow.servidor.trim() : ''
  if (!token || !servidor) {
    throw createError({ statusCode: 400, statusMessage: 'Canal não possui token/servidor configurados.' })
  }

  const url = `${servidor.replace(/\/+$/, '')}/instance/disconnect`

  try {
    const res = await $fetch<any>(url, {
      method: 'POST',
      headers: { token }
    })
    const response = typeof res?.response === 'string' ? res.response : 'Disconnected'
    return { response }
  } catch (err: unknown) {
    const maybe = err as { data?: unknown; message?: string }
    const data = maybe?.data
    const apiErr =
      data && typeof data === 'object' && 'error' in (data as any) ? String((data as any).error ?? '') : ''

    throw createError({
      statusCode: 502,
      statusMessage: apiErr.trim() || maybe?.message || 'Falha ao desconectar instância.'
    })
  }
})

