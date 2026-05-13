/**
 * Cada produto tem no máximo uma categoria. Se a célula/planilha trouxer vários
 * valores separados por `;` `,` ou `|`, usa-se apenas o primeiro (trim).
 * O nome canónico para armazenar / comparar é sempre em **maiúsculas** (`pt-BR`).
 */
export function normalizarTextoCategoriaUnica(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const t = String(raw).trim()
  if (!t) return null
  const parts = t
    .split(/[;,|]/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
  const um = parts[0] ?? t
  if (!um.length) return null
  return um.toLocaleUpperCase('pt-BR')
}
