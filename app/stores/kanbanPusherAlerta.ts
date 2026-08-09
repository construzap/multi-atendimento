import { defineStore } from 'pinia'

type Variante = 'aviso' | 'perigo' | 'info'
type Acao = 'none' | 'abrir_pedido'

type KanbanPusherAlertaState = {
  open: boolean
  title: string
  texto: string
  variante: Variante
  textoConfirmar: string
  textoCancelar: string
  mostrarCancelar: boolean
  conversaKey: string | null
  acao: Acao
}

export const useKanbanPusherAlertaStore = defineStore('kanbanPusherAlerta', {
  state: (): KanbanPusherAlertaState => ({
    open: false,
    title: '',
    texto: '',
    variante: 'info',
    textoConfirmar: 'Ok',
    textoCancelar: 'Fechar',
    mostrarCancelar: true,
    conversaKey: null,
    acao: 'none',
  }),
  actions: {
    showColunaMovida(contato: string) {
      this.title = 'Kanban atualizado'
      this.texto = `${contato} mudou de coluna.`
      this.variante = 'info'
      this.textoConfirmar = 'Ok'
      this.textoCancelar = 'Fechar'
      this.mostrarCancelar = false
      this.conversaKey = null
      this.acao = 'none'
      this.open = true
    },

    showPedidoNovo(contato: string, conversaKey: string) {
      this.title = 'Pedido novo!'
      this.texto = `${contato} acabou de enviar um pedido. Abra agora para aceitar ou rejeitar.`
      this.variante = 'info'
      this.textoConfirmar = 'Abrir Área de Pedidos'
      this.textoCancelar = 'Depois'
      this.mostrarCancelar = true
      this.conversaKey = conversaKey
      this.acao = 'abrir_pedido'
      this.open = true
    },

    close() {
      this.open = false
      this.conversaKey = null
      this.acao = 'none'
    },
  },
})
