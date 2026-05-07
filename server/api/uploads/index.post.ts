import { serverSupabaseClient } from '#supabase/server'
import { createError, readBody } from 'h3'
import { checkChannel } from '../../utils/checkChannel'
import { getAuthUserId } from '../../utils/getAuthUserId'
import { mimeToExt, uploadToB2 } from '../../utils/b2Storage'

type Body = {
  id_canal?: number | string
  /** MIME do arquivo (ex.: image/jpeg, video/mp4, audio/webm). */
  mime?: string
  /** Nome original (opcional, só para heurística). */
  filename?: string
  /**
   * Base64 do arquivo.
   * Pode vir como data URL (`data:...;base64,AAAA`) ou apenas a parte base64.
   */
  data_base64?: string
}

function safeMime(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : ''
  return (s.split(';')[0] ?? '').trim().toLowerCase()
}

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
  if (!Number.isFinite(canalId) || !Number.isInteger(canalId)) {
    throw createError({ statusCode: 400, statusMessage: 'id_canal inválido.' })
  }

  const allowed = await checkChannel(event, canalId, userId)
  if (!allowed) {
    throw createError({ statusCode: 403, statusMessage: 'Sem permissão para este canal.' })
  }

  const mime = safeMime(body.mime)
  if (!mime) {
    throw createError({ statusCode: 400, statusMessage: 'Informe mime.' })
  }

  const raw = typeof body.data_base64 === 'string' ? body.data_base64.trim() : ''
  if (!raw) {
    throw createError({ statusCode: 400, statusMessage: 'Informe data_base64.' })
  }

  const base64 = raw.includes('base64,') ? raw.split('base64,')[1] ?? '' : raw
  let buffer: Buffer
  try {
    buffer = Buffer.from(base64, 'base64')
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'data_base64 inválido.' })
  }

  // Limite simples (20MB) para evitar abuso.
  const maxBytes = 20 * 1024 * 1024
  if (buffer.length <= 0 || buffer.length > maxBytes) {
    throw createError({ statusCode: 413, statusMessage: 'Arquivo muito grande (máx 20MB).' })
  }

  const ext = mimeToExt(mime)
  const rand = Math.random().toString(36).slice(2, 10)
  const key = `uploads/${canalId}/${Date.now()}_${rand}${ext}`

  const url = await uploadToB2(buffer, key, mime)
  const filename = typeof body.filename === 'string' && body.filename.trim() ? body.filename.trim() : null

  return { ok: true, url, key, filename, mime, size: buffer.length }
})

