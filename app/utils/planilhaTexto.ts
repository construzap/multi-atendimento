/**
 * Utilitários de texto para importação de planilha (sem dependência de `xlsx`).
 * Mantidos separados para o bundler SSR não puxar SheetJS em páginas que só usam `cellToString`.
 */

/**
 * Corrige texto que era UTF-8 mas foi interpretado como Latin-1 (ex.: cabeçalhos CSV: "CÃ³digo" → "Código").
 */
export function corrigirMojibakeUtf8(s: string): string {
  if (!s || !/Ã.|Â./.test(s)) return s
  try {
    const buf = new Uint8Array(s.length)
    for (let i = 0; i < s.length; i++) buf[i] = s.charCodeAt(i) & 0xff
    const out = new TextDecoder('utf-8', { fatal: false }).decode(buf)
    if (out.includes('\uFFFD')) return s
    return out
  } catch {
    return s
  }
}

export function cellToString(c: unknown): string {
  if (c == null || c === '') return ''
  if (typeof c === 'string') return corrigirMojibakeUtf8(c.trim())
  if (typeof c === 'number' && Number.isFinite(c)) return String(c)
  return corrigirMojibakeUtf8(String(c).trim())
}
