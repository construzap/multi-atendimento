/**
 * Se `preco_prazo` tiver valor válido, mantém.
 * Se vier vazio/null, usa o mesmo valor de `preco` (preço à vista).
 */
export function resolverPrecoPrazo(
  preco: number | null | undefined,
  precoPrazo: number | null | undefined,
): number | null {
  if (precoPrazo != null && Number.isFinite(precoPrazo) && precoPrazo >= 0) {
    return precoPrazo
  }
  if (preco != null && Number.isFinite(preco) && preco >= 0) {
    return preco
  }
  return null
}
