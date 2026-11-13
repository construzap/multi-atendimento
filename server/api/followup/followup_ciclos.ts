import type { FollowupCiclo } from '#shared/types/followup'
import { cancelarTodasEtapasDoCiclo } from './followup_etapas'

type SupabaseAdmin = ReturnType<
  typeof import('#supabase/server').serverSupabaseServiceRole<any>
>

const CICLO_SELECT =
  'id, workspace_id, conversa_key, canal_id, atendente_id, mensagem_gatilho_id, status, iniciado_em, encerrado_em, respondido_em, etapa_resposta, resposta_mensagem_id, total_etapas, total_enviadas, created_at' as const

export async function buscarCicloAtivo(
  admin: SupabaseAdmin,
  conversa_key: string,
): Promise<FollowupCiclo | null> {
  const key = conversa_key.trim()
  if (!key) return null

  const { data, error } = await admin
    .from('followup_ciclos')
    .select(CICLO_SELECT)
    .eq('conversa_key', key)
    .eq('status', 'ativo')
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? (data as FollowupCiclo) : null
}

/** Cancela ciclo ativo e todas as etapas ainda não finalizadas. */
export async function cancelarCicloAtivo(
  admin: SupabaseAdmin,
  ciclo: FollowupCiclo,
): Promise<void> {
  const now = new Date().toISOString()

  await cancelarTodasEtapasDoCiclo(admin, ciclo.id)

  const { error } = await admin
    .from('followup_ciclos')
    .update({
      status: 'cancelado',
      encerrado_em: now,
    })
    .eq('id', ciclo.id)
    .eq('status', 'ativo')

  if (error) throw new Error(error.message)
}

export type CriarCicloInput = {
  workspace_id: number
  conversa_key: string
  canal_id: number | null
  mensagem_gatilho_id: string | null
  total_etapas: number
}

export async function criarCiclo(
  admin: SupabaseAdmin,
  input: CriarCicloInput,
): Promise<FollowupCiclo> {
  const now = new Date().toISOString()

  const { data, error } = await admin
    .from('followup_ciclos')
    .insert({
      workspace_id: input.workspace_id,
      conversa_key: input.conversa_key,
      canal_id: input.canal_id,
      atendente_id: null,
      mensagem_gatilho_id: input.mensagem_gatilho_id,
      status: 'ativo',
      iniciado_em: now,
      encerrado_em: null,
      respondido_em: null,
      etapa_resposta: null,
      resposta_mensagem_id: null,
      total_etapas: input.total_etapas,
      total_enviadas: 0,
      created_at: now,
    })
    .select(CICLO_SELECT)
    .single()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Falha ao criar followup_ciclos (sem retorno).')
  return data as FollowupCiclo
}

export type MarcarCicloRespondidoInput = {
  resposta_mensagem_id: string | null
  etapa_resposta: number | null
  total_enviadas: number
}

export async function marcarCicloRespondido(
  admin: SupabaseAdmin,
  ciclo: FollowupCiclo,
  input: MarcarCicloRespondidoInput,
): Promise<void> {
  const now = new Date().toISOString()

  const { error } = await admin
    .from('followup_ciclos')
    .update({
      status: 'respondido',
      respondido_em: now,
      resposta_mensagem_id: input.resposta_mensagem_id,
      etapa_resposta: input.etapa_resposta,
      total_enviadas: input.total_enviadas,
    })
    .eq('id', ciclo.id)
    .eq('status', 'ativo')

  if (error) throw new Error(error.message)
}
