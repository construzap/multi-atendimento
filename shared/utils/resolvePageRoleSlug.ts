/**
 * Extrai o slug de `page_roles.pages` a partir do trecho após `/workspaces/:id/`.
 * Páginas novas caem no 1º segmento automaticamente.
 *
 * Exemplos:
 * - `chat` → `chat`
 * - `chat/12/abc` → `chat`
 * - `produtos/criar` → `produtos`
 * - `produtos/enviar-para-ia/vector-store` → `vector-store`
 * - `kanban/5` → `kanban`
 */
export function resolvePageRoleSlug(pathAfterWorkspaceId: string): string | null {
  const parts = String(pathAfterWorkspaceId ?? '')
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean)

  if (parts.length === 0) return null

  if (
    parts[0] === 'produtos' &&
    parts[1] === 'enviar-para-ia' &&
    parts[2] === 'vector-store'
  ) {
    return 'vector-store'
  }

  return parts[0] ?? null
}

/** Parseia `/workspaces/:id/...` e devolve workspace + slug da página (ou null). */
export function parseWorkspacePageRoute(
  path: string,
): { workspaceId: number; pageSlug: string } | null {
  const m = String(path ?? '').match(/^\/workspaces\/(\d+)(?:\/(.*))?$/)
  if (!m) return null

  const workspaceId = Number.parseInt(m[1]!, 10)
  if (!Number.isFinite(workspaceId) || workspaceId < 1) return null

  const pageSlug = resolvePageRoleSlug(m[2] ?? '')
  if (!pageSlug) return null

  return { workspaceId, pageSlug }
}
