import { createError } from 'h3'

export type UazapiWebhookRegistro = {
  id: string
  url: string
}

type UazapiCredenciais = {
  base: string
  token: string
}

export function validarCredenciaisInstancia(servidor: string, token: string): UazapiCredenciais {
  const base = String(servidor ?? '').trim().replace(/\/+$/, '')
  const tok = String(token ?? '').trim()

  if (!base || !tok) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Canal não possui token/servidor configurados.',
    })
  }

  return { base, token: tok }
}

export function headersUazapiWebhook(token: string): Record<string, string> {
  return {
    Accept: 'application/json',
    token,
  }
}

export function extrairErroUazapi(err: unknown, fallback: string): string {
  const maybe = err as { data?: unknown; message?: string }
  const data = maybe?.data
  const apiErr =
    data && typeof data === 'object' && 'error' in (data as Record<string, unknown>)
      ? String((data as Record<string, unknown>).error ?? '')
      : ''

  return apiErr.trim() || maybe?.message || fallback
}

export function normalizarUrlWebhook(url: string): string {
  return String(url ?? '').trim().replace(/\/+$/, '')
}

export function urlsWebhookCoincidem(a: string, b: string): boolean {
  return normalizarUrlWebhook(a) === normalizarUrlWebhook(b)
}

function extrairWebhooks(data: unknown): UazapiWebhookRegistro[] {
  const itens: unknown[] = []

  if (Array.isArray(data)) {
    itens.push(...data)
  } else if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    for (const chave of ['webhooks', 'data', 'items', 'result']) {
      const valor = obj[chave]
      if (Array.isArray(valor)) {
        itens.push(...valor)
        break
      }
    }

    if (!itens.length && typeof obj.id === 'string') {
      itens.push(obj)
    }
  }

  const vistos = new Set<string>()
  const registros: UazapiWebhookRegistro[] = []

  for (const item of itens) {
    if (!item || typeof item !== 'object') continue
    const registro = item as Record<string, unknown>
    const id = String(registro.id ?? registro.webhook_id ?? registro._id ?? '').trim()
    const url = String(registro.url ?? registro.webhook ?? registro.webhookUrl ?? '').trim()
    if (!id || vistos.has(id)) continue
    vistos.add(id)
    registros.push({ id, url })
  }

  return registros
}

export async function listarWebhooksInstanciaUazapi(
  servidor: string,
  token: string,
): Promise<UazapiWebhookRegistro[]> {
  const { base, token: tok } = validarCredenciaisInstancia(servidor, token)
  const url = `${base}/webhook`

  try {
    const data = await $fetch<unknown>(url, {
      method: 'GET',
      headers: headersUazapiWebhook(tok),
    })
    return extrairWebhooks(data)
  } catch (err: unknown) {
    throw createError({
      statusCode: 502,
      statusMessage: extrairErroUazapi(err, 'Falha ao listar webhooks da instância.'),
    })
  }
}

export function webhookUrlJaExiste(
  webhooks: UazapiWebhookRegistro[],
  urlAlvo: string,
): boolean {
  return webhooks.some((webhook) => urlsWebhookCoincidem(webhook.url, urlAlvo))
}
