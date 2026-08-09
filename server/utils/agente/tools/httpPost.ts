import type { H3Event } from 'h3'

const DEFAULT_TIMEOUT_MS = 60_000
const PREVIEW_MAX = 2000

export type ToolHttpResult = {
  ok: boolean
  http_status?: number
  text: string
}

function preview(text: string): string {
  if (text.length <= PREVIEW_MAX) return text
  return `${text.slice(0, PREVIEW_MAX)}…`
}

/** POST JSON para webhook/tool N8N. Erros viram texto para o modelo (não derrubam o loop). */
export async function postToolHttp(
  event: H3Event,
  url: string,
  body: Record<string, unknown>,
): Promise<ToolHttpResult> {
  const trimmed = url.trim()
  if (!trimmed) {
    return {
      ok: false,
      text: 'URL da ferramenta não configurada no servidor (.env).',
    }
  }

  const config = useRuntimeConfig(event)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/plain, */*',
  }

  const headerName = String(config.agenteToolHttpHeaderName ?? '').trim()
  const headerValue = String(config.agenteToolHttpHeaderValue ?? '').trim()
  if (headerName && headerValue) {
    headers[headerName] = headerValue
  }

  try {
    const res = await fetch(trimmed, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    })

    const raw = await res.text()
    let text = raw
    try {
      const parsed = JSON.parse(raw)
      text = typeof parsed === 'string' ? parsed : JSON.stringify(parsed)
    } catch {
      // keep raw text
    }

    if (!res.ok) {
      return {
        ok: false,
        http_status: res.status,
        text: preview(`HTTP ${res.status}: ${text || res.statusText}`),
      }
    }

    return {
      ok: true,
      http_status: res.status,
      text: preview(text || 'OK'),
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      text: preview(`Erro ao chamar ferramenta HTTP: ${msg}`),
    }
  }
}
