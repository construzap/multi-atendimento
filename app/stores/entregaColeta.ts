import { defineStore } from 'pinia'

/** Dados da última automação de kanban na entrega pública. */
export type EntregaColetaPinia = {
  workspace_id: number
  conversa_key: string
  funil_id: number
  coluna_id: number
  id_agendamento_mensagem: string | null
  canal_id: number | null
  coluna_ordem?: number
  etapa?: 'coletado' | 'no_local' | 'entregue'
  conversa_atualizada?: boolean
  webhook_disparado?: boolean
  webhook_erro?: string | null
  pusher_ok?: boolean
}

export const useEntregaColetaStore = defineStore('entrega-coleta', {
  state: () => ({
    token: null as string | null,
    /** Última etapa aplicada (coletado / no_local / entregue). */
    coleta: null as EntregaColetaPinia | null,
    coletaErro: null as string | null,
    /** Histórico das etapas neste token. */
    historico: [] as EntregaColetaPinia[],
  }),

  getters: {
    funilId(state): number | null {
      return state.coleta?.funil_id ?? null
    },
    colunaId(state): number | null {
      return state.coleta?.coluna_id ?? null
    },
    idAgendamentoMensagem(state): string | null {
      return state.coleta?.id_agendamento_mensagem ?? null
    },
  },

  actions: {
    reset() {
      this.token = null
      this.coleta = null
      this.coletaErro = null
      this.historico = []
    },

    setFromAutomacao(
      token: string,
      coleta: EntregaColetaPinia | null,
      coletaErro: string | null = null,
    ) {
      this.token = token
      this.coleta = coleta
      this.coletaErro = coletaErro
      if (coleta) {
        this.historico = [...this.historico, coleta]
      }
    },
  },
})
