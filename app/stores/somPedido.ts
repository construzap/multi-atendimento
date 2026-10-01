import { defineStore } from 'pinia'
import {
  desativarSomPedidoNovo,
  espelharSomPedidoSalvo,
  lerDecisaoSomPedido,
  permitirSomENotificacoes,
} from '~/utils/SomNavegadorPedidoNovo'

type SomPedidoState = {
  /** `null` até ler a escolha salva. `false` = ainda não decidiu. */
  definido: boolean | null
  ativo: boolean
  modalAberto: boolean
}

export const useSomPedidoStore = defineStore('somPedido', {
  state: (): SomPedidoState => ({
    definido: null,
    ativo: false,
    modalAberto: false,
  }),

  actions: {
    /**
     * Lê a escolha já gravada. Se não existir, abre o aviso.
     * Se já existir, não abre e só deixa `ativo` para o Kanban e o navegador.
     */
    hidratar() {
      if (!import.meta.client || this.definido !== null) return

      const decisao = lerDecisaoSomPedido()
      if (decisao === null) {
        this.definido = false
        this.ativo = false
        this.modalAberto = true
        return
      }

      this.definido = true
      this.ativo = decisao
      this.modalAberto = false
      espelharSomPedidoSalvo(decisao)
    },

    async permitir(): Promise<boolean> {
      const ok = await permitirSomENotificacoes()
      this.definido = true
      this.ativo = ok
      this.modalAberto = false
      return ok
    },

    desativar() {
      desativarSomPedidoNovo()
      this.definido = true
      this.ativo = false
      this.modalAberto = false
    },
  },
})
