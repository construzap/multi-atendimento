export type {
  KanbanNotificacaoProdutoItem,
  KanbanNotificacaoTotalOrcamento,
  ProdutoNotificacaoLinha,
} from '#shared/utils/notificacaoIaProdutos'

export {
  formaPagamentoEhAPrazo,
  formatMoedaBr,
  normalizeProdutosRaw,
  normalizeTotalOrcamento,
  parseProdutosNotificacao,
  resolveTotalOrcamento,
  subtotalLinhaExibicao,
} from '#shared/utils/notificacaoIaProdutos'

export function isPedidoPronto(tipo: string | null | undefined): boolean {
  return (tipo ?? '').trim().toLowerCase() === 'pedido_pronto'
}

export function labelTipoSolicitacao(tipo: string | null | undefined): string {
  const t = (tipo ?? '').trim().toLowerCase()
  if (t === 'pedido_pronto') return 'Pedido pronto'
  if (t === 'transferencia_ia') return 'Transferência I.A.'
  if (!t) return 'Notificação'
  return tipo!.trim().replace(/_/g, ' ')
}
