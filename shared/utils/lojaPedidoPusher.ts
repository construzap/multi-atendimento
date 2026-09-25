export const PUSHER_EVENTO_LOJA_PEDIDO_PAGO = 'pedido-pago'

export function canalPusherLojaPedido(pedidoId: number): string {
  return `loja-pedido-${Math.trunc(pedidoId)}`
}

export type PusherLojaPedidoPagoPayload = {
  id: number
  status: 'pago'
}
