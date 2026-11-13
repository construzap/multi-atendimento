/** Código do sistema externo: trim, preserva letras e zeros à esquerda. */
export function normalizarCodigoExterno(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null
  const s = String(raw).trim()
  return s.length ? s : null
}

/** Chave de busca na `tabelageral`: minúsculas, sem espaço nem pontuação. */
export function normalizarCodigoBarras(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null
  const norm = String(raw).trim().toLowerCase().replace(/[^0-9a-z]/g, '')
  return norm.length ? norm : null
}
