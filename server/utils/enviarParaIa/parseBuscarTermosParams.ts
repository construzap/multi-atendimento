import { createError } from 'h3'
import { parseWorkspaceIdFromBody } from './parseBuscarParams'

export type BuscarTermosParams = {
  query: string
  workspaceId: number
  limit: number
  metadataFilters: Record<string, string> | null
}

function parseMetadataFilters(body: Record<string, unknown>): Record<string, string> | null {
  const filters: Record<string, string> = {}

  const raw = body.metadata
  if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const k = String(key).trim()
      if (!k) continue
      const v = value == null ? '' : String(value).trim()
      if (v) filters[k] = v
    }
  }

  if (body.termo_id != null && String(body.termo_id).trim()) {
    filters.termo_id = String(body.termo_id).trim()
  }
  if (body.nome != null && String(body.nome).trim()) {
    filters.nome = String(body.nome).trim()
  }

  return Object.keys(filters).length ? filters : null
}

export function parseBuscarTermosBody(
  body: Record<string, unknown> | null | undefined,
  options?: { workspaceFallback?: number },
): BuscarTermosParams {
  const query = String(body?.query ?? '').trim()
  if (!query) {
    throw createError({ statusCode: 400, statusMessage: 'query é obrigatório.' })
  }

  const limitRaw = body?.limit
  const limit =
    typeof limitRaw === 'number' && Number.isInteger(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, 50)
      : typeof limitRaw === 'string' && limitRaw.trim()
        ? Math.min(Math.max(1, Number.parseInt(limitRaw, 10) || 10), 50)
        : 10

  const workspaceId = parseWorkspaceIdFromBody(
    body?.workspace_id ?? body?.empresa_id,
    options?.workspaceFallback,
  )

  const metadataFilters = parseMetadataFilters(body ?? {})

  return { query, workspaceId, limit, metadataFilters }
}
