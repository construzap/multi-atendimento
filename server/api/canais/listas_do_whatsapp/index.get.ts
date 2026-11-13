import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type { ListasDoWhatsappResponse, WhatsappLabelItem } from '#shared/types/canal'
import { checkChannel } from '../../../utils/checkChannel'
import { getAuthUserId } from '../../../utils/getAuthUserId'

function mapLabel(raw: unknown): WhatsappLabelItem | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const id = String(o.id ?? '').trim()
  const name = String(o.name ?? '').trim()
  if (!id && !name) return null

  const colorRaw = o.color
  const color =
    typeof colorRaw === 'number' && Number.isFinite(colorRaw)
      ? Math.trunc(colorRaw)
      : typeof colorRaw === 'string' && colorRaw.trim()
        ? Number.parseInt(colorRaw, 10)
        : null

  return {
    id: id || name,
    name: name || id,
    color: Number.isFinite(color as number) ? (color as number) : null,
    colorHex: typeof o.colorHex === 'string' && o.colorHex.trim() ? o.colorHex.trim() : null,
    labelid: typeof o.labelid === 'string' && o.labelid.trim() ? o.labelid.trim() : null,
    owner: typeof o.owner === 'string' && o.owner.trim() ? o.owner.trim() : null,
    created: typeof o.created === 'string' && o.created.trim() ? o.created.trim() : null,
    updated: typeof o.updated === 'string' && o.updated.trim() ? o.updated.trim() : null,
  }
}

/**
 * GET /api/canais/listas_do_whatsapp?id_canal=
 * Busca labels da instância Uazapi (`GET {servidor}/labels`).
 */
export default defineEventHandler(async (event): Promise<ListasDoWhatsappResponse> => {
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

  const canalId = typeof rawCanal === 'number' ? rawCanal : Number.parseInt(String(rawCanal), 10)
  if (!Number.isFinite(canalId) || !Number.isInteger(canalId) || canalId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'id_canal inválido.' })
  }

  const ok = await checkChannel(event, canalId, userId)
  if (!ok) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Você não tem permissão para acessar este canal.',
    })
  }

  const admin = serverSupabaseServiceRole<any>(event)
  const { data: canalRow, error: canalErr } = await admin
    .from('canais')
    .select('token, servidor')
    .eq('id', canalId)
    .is('deleted_at', null)
    .maybeSingle()

  if (canalErr) {
    throw createError({ statusCode: 500, statusMessage: canalErr.message })
  }
  if (!canalRow) {
    throw createError({ statusCode: 404, statusMessage: 'Canal não encontrado.' })
  }

  const token = typeof canalRow.token === 'string' ? canalRow.token.trim() : ''
  const servidor = typeof canalRow.servidor === 'string' ? canalRow.servidor.trim() : ''
  if (!token || !servidor) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Canal não possui token/servidor configurados.',
    })
  }

  const url = `${servidor.replace(/\/+$/, '')}/labels`

  try {
    const res = await $fetch<unknown>(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        token,
      },
    })

    const lista = Array.isArray(res)
      ? res
      : res && typeof res === 'object' && Array.isArray((res as Record<string, unknown>).labels)
        ? ((res as Record<string, unknown>).labels as unknown[])
        : res && typeof res === 'object' && Array.isArray((res as Record<string, unknown>).data)
          ? ((res as Record<string, unknown>).data as unknown[])
          : []

    return {
      labels: lista.map(mapLabel).filter((item): item is WhatsappLabelItem => item != null),
    }
  } catch (err: unknown) {
    const maybe = err as { data?: unknown; message?: string }
    const data = maybe?.data
    const apiErr =
      data && typeof data === 'object' && 'error' in (data as Record<string, unknown>)
        ? String((data as Record<string, unknown>).error ?? '')
        : ''

    throw createError({
      statusCode: 502,
      statusMessage: apiErr.trim() || maybe?.message || 'Falha ao buscar listas do WhatsApp.',
    })
  }
})
