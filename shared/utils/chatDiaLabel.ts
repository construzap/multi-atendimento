/** Chave YYYY-MM-DD no fuso local (agrupa mensagens do mesmo dia). */
export function dayKeyFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function inicioDoDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

const DIAS_SEMANA = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const

/**
 * Rótulo estilo WhatsApp:
 * - hoje → Hoje
 * - ontem → Ontem
 * - até 6 dias atrás → dia da semana
 * - mais antigo → DD/MM/AAAA
 */
export function labelDiaChat(iso: string | null | undefined, agora: Date = new Date()): string {
  const d = iso ? new Date(iso) : null
  if (!d || Number.isNaN(d.getTime())) return ''

  const diffDias = Math.round(
    (inicioDoDia(agora).getTime() - inicioDoDia(d).getTime()) / 86_400_000,
  )

  if (diffDias === 0) return 'Hoje'
  if (diffDias === 1) return 'Ontem'
  if (diffDias >= 2 && diffDias <= 6) return DIAS_SEMANA[d.getDay()] ?? ''

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}
