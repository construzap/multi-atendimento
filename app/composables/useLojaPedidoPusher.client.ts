import type { MaybeRefOrGetter } from 'vue'
import { onUnmounted, toValue, watch } from 'vue'
import {
  canalPusherLojaPedido,
  PUSHER_EVENTO_LOJA_PEDIDO_PAGO,
  type PusherLojaPedidoPagoPayload,
} from '#shared/utils/lojaPedidoPusher'

type PusherClient = import('pusher-js').default

/** Escuta `loja-pedido-{id}` só no browser. Não carrega pusher-js no SSR. */
export function useLojaPedidoPusher(
  pedidoId: MaybeRefOrGetter<number | null | undefined>,
  onPago: () => void,
) {
  const config = useRuntimeConfig()
  const appKey = typeof config.public.pusherKey === 'string' ? config.public.pusherKey.trim() : ''
  const cluster =
    typeof config.public.pusherCluster === 'string' ? config.public.pusherCluster.trim() : ''

  let client: PusherClient | null = null
  let canalAtual = ''
  let carregando = false

  function desligar() {
    if (!client) return
    if (canalAtual) client.unsubscribe(canalAtual)
    canalAtual = ''
    client.disconnect()
    client = null
  }

  async function inscrever(id: number) {
    if (!appKey || !cluster || id < 1 || carregando) return
    const nome = canalPusherLojaPedido(id)
    if (nome === canalAtual && client) return

    carregando = true
    try {
      if (!client) {
        const { default: Pusher } = await import('pusher-js')
        client = new Pusher(appKey, { cluster })
      }
      if (canalAtual && canalAtual !== nome) {
        client.unsubscribe(canalAtual)
      }
      canalAtual = nome
      const channel = client.subscribe(nome)
      channel.bind(PUSHER_EVENTO_LOJA_PEDIDO_PAGO, (data: PusherLojaPedidoPagoPayload) => {
        if (data?.status === 'pago' && Number(data.id) === id) onPago()
      })
    } finally {
      carregando = false
    }
  }

  watch(
    () => toValue(pedidoId),
    (id) => {
      if (id == null || id < 1) {
        desligar()
        return
      }
      void inscrever(id)
    },
    { immediate: true },
  )

  onUnmounted(desligar)
}
