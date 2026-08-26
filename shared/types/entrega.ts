/** Status sequencial do fluxo público do entregador. */
export type EntregaStatus =
  | 'aguardando_entregador'
  | 'coletado'
  | 'no_local'
  | 'entregue'

export const ENTREGA_STATUS_ORDEM: readonly EntregaStatus[] = [
  'aguardando_entregador',
  'coletado',
  'no_local',
  'entregue',
] as const

export function isEntregaStatus(v: unknown): v is EntregaStatus {
  return (
    v === 'aguardando_entregador' ||
    v === 'coletado' ||
    v === 'no_local' ||
    v === 'entregue'
  )
}

/** Resumo seguro da entrega (sem codigo_confirmacao). */
export type EntregaPublicaResumo = {
  pedido_id: number
  pedido_label: string
  entrega_status: EntregaStatus
  /** Já tem entregador vinculado. */
  entregador_identificado: boolean
  entregador_nome: string | null
  loja_nome: string | null
  endereco: string | null
  cliente_nome: string | null
}

export type EntregaPublicaResumoResponse = {
  ok: true
  data: EntregaPublicaResumo
}
