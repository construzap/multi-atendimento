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
  if (typeof c === 'number' && Number.isFinite(c)) return formatarNumeroPlanilha(c)
  return corrigirMojibakeUtf8(String(c).trim())
}

/** Número da planilha no formato brasileiro, sem separador de milhar (`13,69`). */
export function formatarNumeroPlanilha(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 10,
    useGrouping: false,
  }).format(n)
}

/**
 * O texto formatado pelo Excel confere com o número cru da célula.
 * Formatos de moeda em pt-BR às vezes saem como `R$ 136,900.00` para o valor `13,69`.
 */
export function textoFormatadoConfereNumero(raw: number, texto: string): boolean {
  const n = numeroDeTextoPlanilha(texto)
  if (n == null) return false
  const escala = Math.max(Math.abs(raw), Math.abs(n), 1)
  return Math.abs(raw - n) <= escala * 0.001
}

function numeroDeTextoPlanilha(texto: string): number | null {
  let t = texto.trim().replace(/\s/g, '').replace(/[^\d,.-]/g, '')
  if (!t || t === '-' || t === ',' || t === '.') return null
  if (t.includes(',') && t.includes('.')) {
    const lastComma = t.lastIndexOf(',')
    const lastDot = t.lastIndexOf('.')
    if (lastComma > lastDot) t = t.replace(/\./g, '').replace(',', '.')
    else t = t.replace(/,/g, '')
  } else if (t.includes(',')) {
    t = t.replace(/\./g, '').replace(',', '.')
  }
  const n = Number.parseFloat(t)
  return Number.isFinite(n) ? n : null
}
