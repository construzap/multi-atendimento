/**
 * Tabelas `public.followup_ciclos` e `public.followup_etapas`.
 */

export type FollowupCicloStatus = 'ativo' | 'respondido' | 'concluido' | 'cancelado'

export type FollowupEtapaStatus = 'programado' | 'enviado' | 'cancelado' | 'erro'

export type FollowupCiclo = {
  id: number
  workspace_id: number
  conversa_key: string
  canal_id: number | null
  atendente_id: number | null
  mensagem_gatilho_id: string | null
  status: FollowupCicloStatus
  iniciado_em: string
  encerrado_em: string | null
  respondido_em: string | null
  etapa_resposta: number | null
  resposta_mensagem_id: string | null
  total_etapas: number
  total_enviadas: number
  created_at: string
}

export type FollowupEtapa = {
  id: number
  ciclo_id: number
  workspace_id: number
  numero_etapa: number
  intervalo_minutos: number
  status: FollowupEtapaStatus
  programado_em: string
  enviado_em: string | null
  cancelado_em: string | null
  mensagem_id: string | null
  erro: string | null
  tentativas: number
  created_at: string
}
