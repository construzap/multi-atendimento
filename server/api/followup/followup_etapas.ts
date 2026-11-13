import { DateTime } from 'luxon'
import type { CanalConfigFollowUp } from '#shared/types/canal'
import { calcularProgramadoEmIso } from './followupJanela'

type SupabaseAdmin = ReturnType<
  typeof import('#supabase/server').serverSupabaseServiceRole<any>
>

/** Passos ordenados por número de etapa. */
export function passosConfigOrdenados(
  config: CanalConfigFollowUp,
): { numero_etapa: number; minutos_espera: number }[] {
  return Object.entries(config)
    .map(([k, v]) => ({
      numero_etapa: Number.parseInt(k, 10),
      minutos_espera: Math.trunc(v.minutos_espera),
    }))
    .filter((p) => Number.isFinite(p.numero_etapa) && p.numero_etapa > 0 && p.minutos_espera >= 1)
    .sort((a, b) => a.numero_etapa - b.numero_etapa)
}

export async function criarEtapasDoCiclo(
  admin: SupabaseAdmin,
  input: {
    ciclo_id: number
    workspace_id: number
    config: CanalConfigFollowUp
  },
): Promise<void> {
  const passos = passosConfigOrdenados(input.config)
  if (!passos.length) return

  const agora = DateTime.now()
  const createdAt = agora.toUTC().toISO() ?? new Date().toISOString()
  let acumulado = 0
  const rows: Record<string, unknown>[] = []

  for (const passo of passos) {
    acumulado += passo.minutos_espera
    const programadoEm = calcularProgramadoEmIso(acumulado, agora)
    if (!programadoEm) {
      throw new Error(`Falha ao calcular programado_em da etapa ${passo.numero_etapa}.`)
    }
    rows.push({
      ciclo_id: input.ciclo_id,
      workspace_id: input.workspace_id,
      numero_etapa: passo.numero_etapa,
      intervalo_minutos: passo.minutos_espera,
      status: 'programado',
      programado_em: programadoEm,
      enviado_em: null,
      cancelado_em: null,
      mensagem_id: null,
      erro: null,
      tentativas: 0,
      created_at: createdAt,
    })
  }

  const { error } = await admin.from('followup_etapas').insert(rows)
  if (error) throw new Error(error.message)
}

/** Cancela etapas ainda `programado` (resposta do cliente). */
export async function cancelarEtapasProgramadas(
  admin: SupabaseAdmin,
  ciclo_id: number,
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await admin
    .from('followup_etapas')
    .update({
      status: 'cancelado',
      cancelado_em: now,
    })
    .eq('ciclo_id', ciclo_id)
    .eq('status', 'programado')

  if (error) throw new Error(error.message)
}

/**
 * Ao reiniciar ciclo do vendedor: cancela etapas que ainda não foram enviadas
 * (`programado` ou `erro`).
 */
export async function cancelarTodasEtapasDoCiclo(
  admin: SupabaseAdmin,
  ciclo_id: number,
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await admin
    .from('followup_etapas')
    .update({
      status: 'cancelado',
      cancelado_em: now,
    })
    .eq('ciclo_id', ciclo_id)
    .in('status', ['programado', 'erro'])

  if (error) throw new Error(error.message)
}

export type MaiorEtapaEnviadaResult = {
  etapa_resposta: number | null
  total_enviadas: number
}

export async function maiorEtapaEnviada(
  admin: SupabaseAdmin,
  ciclo_id: number,
): Promise<MaiorEtapaEnviadaResult> {
  const { data, error } = await admin
    .from('followup_etapas')
    .select('numero_etapa')
    .eq('ciclo_id', ciclo_id)
    .eq('status', 'enviado')
    .order('numero_etapa', { ascending: false })

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as { numero_etapa: number }[]
  if (!rows.length) {
    return { etapa_resposta: null, total_enviadas: 0 }
  }

  return {
    etapa_resposta: rows[0]!.numero_etapa,
    total_enviadas: rows.length,
  }
}
