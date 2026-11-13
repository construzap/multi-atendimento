import { DateTime } from 'luxon'

/** Horário local a partir do qual o follow-up não pode ser agendado (21 → empurra para 08h). */
export const FOLLOW_UP_HORA_FIM_PERMITIDO = 21
/** Horário local para o qual o follow-up é empurrado quando cai fora da janela. */
export const FOLLOW_UP_HORA_INICIO_PERMITIDO = 8
export const FOLLOW_UP_TIMEZONE = 'America/Sao_Paulo'

/**
 * Empurra `candidate` para 08:00 local se cair entre 21:00 e 08:00
 * (America/Sao_Paulo). 21:00 em diante → 08:00 do dia seguinte; antes de 08:00 → 08:00 do mesmo dia.
 */
export function ajustarDataProximoDisparoParaJanela(candidate: DateTime): DateTime {
  const local = candidate.setZone(FOLLOW_UP_TIMEZONE)
  const hour = local.hour
  if (hour >= FOLLOW_UP_HORA_FIM_PERMITIDO) {
    return local
      .plus({ days: 1 })
      .set({
        hour: FOLLOW_UP_HORA_INICIO_PERMITIDO,
        minute: 0,
        second: 0,
        millisecond: 0,
      })
  }
  if (hour < FOLLOW_UP_HORA_INICIO_PERMITIDO) {
    return local.set({
      hour: FOLLOW_UP_HORA_INICIO_PERMITIDO,
      minute: 0,
      second: 0,
      millisecond: 0,
    })
  }
  return local
}

/** now + minutos, ajustado à janela permitida, em ISO UTC. */
export function calcularProgramadoEmIso(minutosAcumulados: number, agora = DateTime.now()): string | null {
  const candidate = agora.setZone(FOLLOW_UP_TIMEZONE).plus({ minutes: minutosAcumulados })
  const ajustada = ajustarDataProximoDisparoParaJanela(candidate)
  return ajustada.toUTC().toISO()
}
