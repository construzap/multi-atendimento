/**
 * Rótulo em português a partir de `intervalo_recorrencia` do Postgres (ex.: `1 day`, `7 days`, `1 mon`).
 */
export function intervaloRecorrenciaLabelPt(intervalo: string | null | undefined): string {
  if (intervalo == null || String(intervalo).trim() === '') return ''
  const t = String(intervalo).trim().toLowerCase()
  if (t.includes('year') || t.includes('years')) return 'Anual'
  if (t.includes('mon')) return 'Mensal'
  if (t.includes('week')) return 'Semanal'
  if (t.includes('7') && t.includes('day')) return 'Semanal'
  if (t.includes('day')) return 'Diária'
  return String(intervalo).trim()
}
