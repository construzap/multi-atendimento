/**
 * Importação de termos de pesquisa: separa a célula por `,`,
 * faz trim + maiúsculas (`pt-BR`) e remove vazios/duplicados (case-insensitive).
 *
 * Ex.: «tijolinho, tijolao, bloco» → [«TIJOLINHO», «TIJOLAO», «BLOCO»]
 * Ex.: «tijolinho, tijolao e bloco» → [«TIJOLINHO», «TIJOLAO E BLOCO»]
 */
export function parseTermosImportacaoCelula(raw: string | null | undefined): string[] {
  if (raw == null) return []
  const t = String(raw).trim()
  if (!t) return []

  const seen = new Set<string>()
  const out: string[] = []
  for (const part of t.split(',')) {
    const nome = part.trim()
    if (!nome) continue
    const upper = nome.toLocaleUpperCase('pt-BR')
    const chave = upper.toLowerCase()
    if (seen.has(chave)) continue
    seen.add(chave)
    out.push(upper)
  }
  return out
}

/** @deprecated use parseTermosImportacaoCelula — mantido para um único nome sem split. */
export function normalizarTermoImportacao(raw: string | null | undefined): string | null {
  const list = parseTermosImportacaoCelula(raw)
  return list[0] ?? null
}
