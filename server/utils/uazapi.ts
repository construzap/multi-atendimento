import { createError } from 'h3'

const UAZAPI_SERVER_URL = 'https://construzap.uazapi.com'
const UAZAPI_ADMIN_TOKEN = '1AXHhnMvyf8ys6PQAMvkLWvrAq994yM9Brw8RVKOUt4wKkFmim'

type UazapiInitOk = {
  token?: string
  server?: string
  servidor?: string
}

type UazapiInitError = {
  error?: string
}

export function sanitizeInstanceName(raw: string): string {
  const base = String(raw ?? '').trim()
  if (!base) return ''

  // remove acentos e caracteres inválidos; troca espaços por hífen.
  const normalized = base.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const safe = normalized
    .toLowerCase()
    .replace(/[^a-z0-9-_ ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')

  return safe
}

export async function initUazapiInstance(instanceName: string): Promise<{ token: string; servidor: string }> {
  const name = sanitizeInstanceName(instanceName)
  if (!name) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nome da instância inválido.'
    })
  }

  let res: UazapiInitOk | UazapiInitError
  try {
    res = await $fetch<UazapiInitOk | UazapiInitError>(`${UAZAPI_SERVER_URL}/instance/init`, {
      method: 'POST',
      headers: {
        admintoken: UAZAPI_ADMIN_TOKEN
      },
      body: {
        name
      }
    })
  } catch (err: unknown) {
    // Se houver payload do Nitro/ofetch com `data.error`, tentamos aproveitar.
    const maybe = err as { data?: unknown; message?: string }
    const data = maybe?.data
    const apiErr =
      data && typeof data === 'object' && 'error' in (data as any) ? String((data as any).error ?? '') : ''

    throw createError({
      statusCode: 502,
      statusMessage: apiErr.trim() || maybe?.message || 'Falha ao criar instância na Uazapi.'
    })
  }

  if (res && typeof res === 'object' && 'error' in res && typeof (res as UazapiInitError).error === 'string') {
    const msg = (res as UazapiInitError).error?.trim()
    throw createError({
      statusCode: 502,
      statusMessage: msg || 'Falha ao criar instância na Uazapi.'
    })
  }

  const ok = res as UazapiInitOk
  const token = typeof ok.token === 'string' ? ok.token.trim() : ''
  const servidor =
    (typeof ok.servidor === 'string' && ok.servidor.trim()) ||
    (typeof ok.server === 'string' && ok.server.trim()) ||
    UAZAPI_SERVER_URL

  if (!token) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Uazapi não retornou token da instância.'
    })
  }

  return { token, servidor }
}

/**
 * Remove a instância na Uazapi: **`DELETE {servidor}/instance`**, header `token` (valor do token da instância).
 *
 * `POST /instance` retorna **405** (Method Not Allowed): o endpoint de exclusão aceita **DELETE**, não POST.
 * Sucesso: **200** ou **204** (respostas comuns para DELETE).
 */
export async function deleteUazapiInstance(servidor: string, token: string): Promise<void> {
  const base = String(servidor ?? '').trim().replace(/\/+$/, '')
  const tok = String(token ?? '').trim()
  if (!base || !tok) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Token ou servidor ausentes para remover a instância.'
    })
  }

  const url = `${base}/instance`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { token: tok }
  })

  if (res.status !== 200 && res.status !== 204) {
    const text = await res.text().catch(() => '')
    throw createError({
      statusCode: 502,
      statusMessage:
        `Falha ao remover instância na API do WhatsApp (${res.status}).` +
        (text ? ` ${text.slice(0, 200)}` : '')
    })
  }
}

