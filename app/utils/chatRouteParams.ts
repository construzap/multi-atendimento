export function parsePositiveIntParam(raw: unknown): number | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  if (String(n) !== s) return null
  return n
}

/** Path do chat por canal (seleção de conversa fica no Pinia). */
export function chatCanalPath(workspaceId: number | string, canalId: number): string {
  return `/workspaces/${workspaceId}/chat/${canalId}`
}
