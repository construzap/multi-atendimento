export function parsePositiveIntParam(raw: unknown): number | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  if (String(n) !== s) return null
  return n
}

/** Path do chat por canal (sem conversa na URL). */
export function chatCanalPath(workspaceId: number | string, canalId: number): string {
  return `/workspaces/${workspaceId}/chat/${canalId}`
}

/** Path do chat com conversa selecionada na URL. */
export function chatConversaPath(
  workspaceId: number | string,
  canalId: number,
  conversaKey: string,
): string {
  const key = conversaKey.trim()
  return `/workspaces/${workspaceId}/chat/${canalId}/${encodeURIComponent(key)}`
}

/** Decodifica `conversaKey` do param da rota. */
export function parseConversaKeyParam(raw: unknown): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  try {
    const decoded = decodeURIComponent(s).trim()
    return decoded || null
  } catch {
    return s
  }
}
