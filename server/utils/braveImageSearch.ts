import { createError } from 'h3'
import type { AdminImagemBraveItem } from '#shared/types/admin'

type BraveImageRaw = {
  title?: unknown
  url?: unknown
  source?: unknown
  thumbnail?: { src?: unknown }
  properties?: {
    url?: unknown
    width?: unknown
    height?: unknown
  }
}

type BraveImageResponse = {
  results?: BraveImageRaw[]
  error?: {
    code?: unknown
    detail?: unknown
    message?: unknown
    status?: unknown
  }
  message?: unknown
}

function asText(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : ''
}

function asPositiveInt(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
}

function isHttpUrl(raw: string): boolean {
  return raw.startsWith('http://') || raw.startsWith('https://')
}

function mapItem(raw: BraveImageRaw): AdminImagemBraveItem | null {
  const original = asText(raw.properties?.url)
  const thumb = asText(raw.thumbnail?.src)
  const link = isHttpUrl(original) ? original : isHttpUrl(thumb) ? thumb : ''
  if (!link) return null

  const page = asText(raw.url)
  return {
    title: asText(raw.title) || link,
    link,
    thumbnailLink: isHttpUrl(thumb) ? thumb : null,
    contextLink: isHttpUrl(page) ? page : null,
    displayLink: asText(raw.source) || null,
    width: asPositiveInt(raw.properties?.width),
    height: asPositiveInt(raw.properties?.height),
  }
}

/** Lê a API key do runtimeConfig; lança 503 se faltar configuração. */
export function getBraveSearchApiKey(): string {
  const config = useRuntimeConfig()
  const apiKey = String(config.braveSearchApiKey ?? '').trim()
  if (!apiKey) {
    throw createError({
      statusCode: 503,
      statusMessage:
        'Brave Search não configurado. Defina NUXT_BRAVE_SEARCH_API_KEY no .env.',
    })
  }
  return apiKey
}

/**
 * Busca imagens na Brave Image Search API.
 * @see https://api-dashboard.search.brave.com/documentation/services/image-search
 */
export async function buscarImagensBrave(opts: {
  q: string
  num?: number
  apiKey?: string
}): Promise<AdminImagemBraveItem[]> {
  const q = String(opts.q ?? '').trim()
  if (!q) {
    throw createError({ statusCode: 400, statusMessage: 'Informe o termo de busca (q).' })
  }

  const apiKey = opts.apiKey?.trim() || getBraveSearchApiKey()
  const numRaw = opts.num ?? 8
  const count = Math.min(200, Math.max(1, Math.trunc(Number(numRaw) || 8)))

  const url = new URL('https://api.search.brave.com/res/v1/images/search')
  url.searchParams.set('q', q)
  url.searchParams.set('count', String(count))
  url.searchParams.set('country', 'BR')
  url.searchParams.set('search_lang', 'pt-br')
  url.searchParams.set('safesearch', 'strict')
  url.searchParams.set('spellcheck', 'true')

  let json: BraveImageResponse
  try {
    json = await $fetch<BraveImageResponse>(url.toString(), {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
    })
  } catch (err: unknown) {
    const root = err && typeof err === 'object' ? (err as Record<string, unknown>) : null
    const data = root?.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : null
    const nested =
      data?.error && typeof data.error === 'object'
        ? (data.error as { detail?: unknown; message?: unknown; status?: unknown; meta?: unknown })
        : null
    const detail =
      (typeof nested?.detail === 'string' && nested.detail.trim()) ||
      (typeof nested?.message === 'string' && nested.message.trim()) ||
      (typeof data?.message === 'string' && data.message.trim()) ||
      (typeof root?.statusMessage === 'string' && root.statusMessage.trim()) ||
      'Falha ao consultar a Brave Image Search.'
    const meta =
      nested?.meta && typeof nested.meta === 'object' ? JSON.stringify(nested.meta) : ''
    const msg = meta ? `${detail} ${meta}` : detail
    const statusRaw = nested?.status ?? root?.statusCode
    const code = typeof statusRaw === 'number' ? statusRaw : Number.parseInt(String(statusRaw ?? ''), 10)
    throw createError({
      statusCode: code === 429 ? 429 : code >= 400 && code < 600 ? code : 502,
      statusMessage: msg,
    })
  }

  const errMsg = asText(json.error?.detail) || asText(json.error?.message) || asText(json.message)
  if (json.error && errMsg) {
    const code = asPositiveInt(json.error.status)
    throw createError({
      statusCode: code === 429 ? 429 : 502,
      statusMessage: errMsg,
    })
  }

  const items: AdminImagemBraveItem[] = []
  for (const raw of json.results ?? []) {
    const mapped = mapItem(raw)
    if (mapped) items.push(mapped)
  }
  return items
}
