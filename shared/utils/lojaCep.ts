export function normalizarCep(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 8)
}

export function formatarCep(raw: string): string {
  const d = normalizarCep(raw)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

export function cepCompleto(raw: string): boolean {
  return normalizarCep(raw).length === 8
}
