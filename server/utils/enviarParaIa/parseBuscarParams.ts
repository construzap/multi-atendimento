import { createError } from 'h3'

export type BuscarParams = {
  query: string
  workspaceId: number
  termosPesquisa: string | null
  limit: number
}

export function parseWorkspaceIdFromBody(raw: unknown, fallback?: number): number {
  if (raw === undefined || raw === null || raw === '') {
    if (fallback != null) return fallback
    throw createError({
      statusCode: 400,
      statusMessage: 'workspace_id é obrigatório (aceita também empresa_id).',
    })
  }
  const n = Number.parseInt(String(raw).trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'workspace_id inválido (aceita também empresa_id).',
    })
  }
  return n
}

/** @deprecated use parseWorkspaceIdFromBody */
export const parseEmpresaId = parseWorkspaceIdFromBody

export function parseBuscarBody(
  body: Record<string, unknown> | null | undefined,
  options?: { workspaceFallback?: number; empresaFallback?: number },
): BuscarParams {
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

  const fallback = options?.workspaceFallback ?? options?.empresaFallback
  const workspaceId = parseWorkspaceIdFromBody(
    body?.workspace_id ?? body?.empresa_id,
    fallback,
  )

  const termosPesquisa =
    body?.termos_pesquisa != null && String(body.termos_pesquisa).trim()
      ? String(body.termos_pesquisa).trim()
      : body?.categorias != null && String(body.categorias).trim()
        ? String(body.categorias).trim()
        : null

  return { query, workspaceId, termosPesquisa, limit }
}
