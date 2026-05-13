import { DateTime } from 'luxon'
import { isIanaFusoBrasilPermitido, type IanaFusoBrasil } from '../constants/ianaTimezonesBrasil'

/**
 * Interpreta `data_local` + `hora_local` no fuso IANA e devolve ISO UTC (`timestamptz`).
 * Retorna `null` se combinação inválida ou fuso não permitido.
 */
export function parseDataHoraLocalBrasilParaUtcIso(
  dataLocal: string,
  horaLocal: string,
  iana: string,
): string | null {
  const zone = iana.trim()
  if (!isIanaFusoBrasilPermitido(zone)) return null

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataLocal.trim())
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(horaLocal.trim())
  if (!dateMatch || !timeMatch) return null

  const y = Number(dateMatch[1])
  const mo = Number(dateMatch[2])
  const d = Number(dateMatch[3])
  const hh = Number(timeMatch[1])
  const mm = Number(timeMatch[2])

  if (
    [y, mo, d, hh, mm].some((n) => !Number.isFinite(n)) ||
    mo < 1 ||
    mo > 12 ||
    d < 1 ||
    d > 31 ||
    hh < 0 ||
    hh > 23 ||
    mm < 0 ||
    mm > 59
  ) {
    return null
  }

  const dt = DateTime.fromObject(
    { year: y, month: mo, day: d, hour: hh, minute: mm, second: 0, millisecond: 0 },
    { zone: zone as IanaFusoBrasil },
  )

  if (!dt.isValid) return null
  return dt.toUTC().toISO()
}

/**
 * Converte instante UTC gravado no banco para data/hora exibidas no fuso escolhido.
 */
export function dataHoraLocalEmFuso(
  dataAgendadaUtcIso: string,
  iana: string | null | undefined,
): { data: string; hora: string } | null {
  const raw = (iana ?? '').trim()
  const zone = (isIanaFusoBrasilPermitido(raw) ? raw : 'America/Sao_Paulo') as IanaFusoBrasil

  const base = DateTime.fromISO(dataAgendadaUtcIso, { zone: 'utc' })
  if (!base.isValid) return null

  const local = base.setZone(zone)
  return {
    data: local.toFormat('yyyy-MM-dd'),
    hora: local.toFormat('HH:mm'),
  }
}
