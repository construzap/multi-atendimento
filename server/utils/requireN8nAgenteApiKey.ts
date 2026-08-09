import { createError, getHeader } from 'h3'
import type { H3Event } from 'h3'
import { timingSafeEqual } from 'node:crypto'

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/**
 * Valida API Key para POST /api/public/agente/responder (N8N).
 * Auth: `Authorization: Bearer <NUXT_N8N_AGENTE_API_KEY>` ou `x-api-key: <…>`.
 */
export function requireN8nAgenteApiKey(event: H3Event): void {
  const config = useRuntimeConfig(event)
  const expected = String(config.n8nAgenteApiKey ?? '').trim()

  if (!expected) {
    throw createError({
      statusCode: 500,
      statusMessage: 'NUXT_N8N_AGENTE_API_KEY não configurada no servidor.',
    })
  }

  const authorization = getHeader(event, 'authorization') ?? ''
  const headerKey = getHeader(event, 'x-api-key') ?? ''

  let token = headerKey.trim()
  if (authorization.toLowerCase().startsWith('bearer ')) {
    token = authorization.slice(7).trim()
  }

  if (!token || !safeEqual(token, expected)) {
    throw createError({ statusCode: 401, statusMessage: 'Não autorizado.' })
  }
}
