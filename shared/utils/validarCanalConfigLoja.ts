import type { CanalHorarioDia, CanalHorarios } from '#shared/types/canal'

const DIAS: (keyof CanalHorarios)[] = ['semana', 'sabado', 'domingo']

function horarioValido(valor: unknown): boolean {
  return typeof valor === 'string' && /^\d{2}:\d{2}$/.test(valor.trim())
}

function parseHorarioDia(raw: unknown, label: string): CanalHorarioDia | string {
  if (!raw || typeof raw !== 'object') return `Horários inválidos (${label}).`

  const o = raw as Record<string, unknown>
  if (typeof o.aberto !== 'boolean') return `Informe se a loja abre em ${label}.`
  if (!horarioValido(o.inicio)) return `Horário de abertura inválido (${label}).`
  if (!horarioValido(o.fim)) return `Horário de fechamento inválido (${label}).`

  const inicioAlmoco = typeof o.inicioAlmoco === 'string' ? o.inicioAlmoco.trim() : ''
  const fimAlmoco = typeof o.fimAlmoco === 'string' ? o.fimAlmoco.trim() : ''
  const temInicioAlmoco = Boolean(inicioAlmoco)
  const temFimAlmoco = Boolean(fimAlmoco)

  if (temInicioAlmoco !== temFimAlmoco) {
    return `Preencha início e fim do almoço em ${label}, ou deixe os dois vazios.`
  }
  if (temInicioAlmoco && !horarioValido(inicioAlmoco)) {
    return `Horário de início do almoço inválido (${label}).`
  }
  if (temFimAlmoco && !horarioValido(fimAlmoco)) {
    return `Horário de fim do almoço inválido (${label}).`
  }

  return {
    aberto: o.aberto,
    inicio: String(o.inicio).trim(),
    inicioAlmoco,
    fimAlmoco,
    fim: String(o.fim).trim(),
  }
}

export function parseCanalHorarios(raw: unknown): CanalHorarios | string {
  if (!raw || typeof raw !== 'object') return 'Informe os horários de funcionamento.'

  const o = raw as Record<string, unknown>
  const result = {} as CanalHorarios

  for (const dia of DIAS) {
    const parsed = parseHorarioDia(o[dia], dia)
    if (typeof parsed === 'string') return parsed
    result[dia] = parsed
  }

  return result
}

export function parseEndereco(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  return t || null
}

export function parseLatitude(raw: unknown): number | string {
  return parseCoordenadaNumerica(raw, -90, 90, 'Latitude')
}

export function parseLongitude(raw: unknown): number | string {
  return parseCoordenadaNumerica(raw, -180, 180, 'Longitude')
}

function parseCoordenadaNumerica(
  raw: unknown,
  min: number,
  max: number,
  label: string,
): number | string {
  if (raw === null || raw === undefined) {
    return `${label} inválida (entre ${min} e ${max}).`
  }

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < min || raw > max) {
      return `${label} inválida (entre ${min} e ${max}).`
    }
    return raw
  }

  const s = String(raw).trim().replace(',', '.').replace('−', '-')
  if (!s) {
    return `${label} inválida (entre ${min} e ${max}).`
  }

  const n = Number.parseFloat(s)
  if (!Number.isFinite(n) || n < min || n > max) {
    return `${label} inválida (entre ${min} e ${max}).`
  }

  return n
}

export function parseTempoAvisoMinutos(raw: unknown): number | string {
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || n < 0) return 'Tempo de aviso inválido (informe minutos >= 0).'
  return n
}
