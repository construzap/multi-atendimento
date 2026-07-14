export function parsePositiveIntParam(raw: unknown): number | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  if (String(n) !== s) return null
  return n
}

export function parseConversaKeyParam(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  try {
    return decodeURIComponent(s).trim()
  } catch {
    return s
  }
}

export type ChatRouteParams = {
  canalId: number
  conversaKey: string | null
}

/** Extrai `canalId` e `conversaKey` de rotas `/workspaces/:id/chat/:canalId/...`. */
export function parseChatRouteParams(route: {
  path: string
  params: Record<string, unknown>
}): ChatRouteParams | null {
  if (!route.path.includes('/chat/')) return null
  const canalId = parsePositiveIntParam(route.params.canalId)
  if (canalId == null) return null
  const key = parseConversaKeyParam(route.params.conversaKey)
  return { canalId, conversaKey: key || null }
}

export function chatConversaPath(
  workspaceId: number | string,
  canalId: number,
  conversaKey: string,
): string {
  return `/workspaces/${workspaceId}/chat/${canalId}/${encodeURIComponent(conversaKey.trim())}`
}
