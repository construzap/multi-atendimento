import { createError } from 'h3'
import type { H3Event } from 'h3'

export type UazapiWebhookAddPayload = {
  action: 'add'
  enabled: true
  url: string
  events: ['messages']
  excludeMessages: ['isGroupYes']
}

/**
 * Registra o webhook de I.A na instância Uazapi: **POST {servidor}/webhook**.
 * Headers: `Accept: application/json`, `token: {token}`.
 */
export async function adicionarWebhookInstanciaIa(
  servidor: string,
  token: string,
  webhookUrl: string,
): Promise<void> {
  const base = String(servidor ?? '').trim().replace(/\/+$/, '')
  const tok = String(token ?? '').trim()
  const urlDestino = String(webhookUrl ?? '').trim()

  if (!base || !tok) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Canal não possui token/servidor configurados.',
    })
  }

  if (!urlDestino) {
    throw createError({
      statusCode: 500,
      statusMessage: 'URL_IA_N8N não configurada no servidor.',
    })
  }

  const url = `${base}/webhook`
  const body: UazapiWebhookAddPayload = {
    action: 'add',
    enabled: true,
    url: urlDestino,
    events: ['messages'],
    excludeMessages: ['isGroupYes'],
  }

  try {
    await $fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        token: tok,
      },
      body,
    })
  } catch (err: unknown) {
    const maybe = err as { data?: unknown; message?: string }
    const data = maybe?.data
    const apiErr =
      data && typeof data === 'object' && 'error' in (data as Record<string, unknown>)
        ? String((data as Record<string, unknown>).error ?? '')
        : ''

    throw createError({
      statusCode: 502,
      statusMessage:
        apiErr.trim() || maybe?.message || 'Falha ao registrar webhook da instância.',
    })
  }
}

export function requireUrlIaN8n(event: H3Event): string {
  const config = useRuntimeConfig(event)
  const url = String(config.urlIaN8n ?? '').trim()

  if (!url) {
    throw createError({
      statusCode: 500,
      statusMessage: 'URL_IA_N8N não configurada no servidor.',
    })
  }

  return url
}
