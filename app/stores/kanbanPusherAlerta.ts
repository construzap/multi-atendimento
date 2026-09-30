import { defineStore } from 'pinia'
import {
  alertarPedidoForaDaAba,
  cancelarAlertaPedidoForaDaAba,
} from '~/utils/notificarPedidoNovoSistema'
import {
  pararSomNavegadorPedidoNovo,
  somPedidoEstaLiberado,
  SomNavegadorPedidoNovo,
} from '~/utils/SomNavegadorPedidoNovo'

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
    /** Abre o modal. O sino, se estiver liberado, já foi iniciado em `showPedidoNovo`. */
    abrirModalPedido() {
      cancelarAlertaPedidoForaDaAba()
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

      // Com o som liberado no clique, o MP3 toca mesmo com outra aba na frente.
      if (somPedidoEstaLiberado()) {
        SomNavegadorPedidoNovo()
      }

      const abaOculta = import.meta.client && document.visibilityState === 'hidden'
      if (abaOculta) {
        this.open = false
        alertarPedidoForaDaAba({
          titulo: this.title,
          texto: this.texto,
          aoVoltar: () => this.abrirModalPedido(),
        })
        return
      }

      this.abrirModalPedido()
    },

    close() {
      cancelarAlertaPedidoForaDaAba()
      pararSomNavegadorPedidoNovo()
      this.open = false
      this.conversaKey = null
      this.acao = 'none'
    },
  },
})
