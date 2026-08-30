export type {
  KanbanNotificacaoProdutoItem,
  KanbanNotificacaoTotalOrcamento,
} from '#shared/types/kanban'

export type { ProdutoNotificacaoLinha } from '#shared/utils/notificacaoIaProdutos'

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

/** Pedido pronto ainda em fluxo (qualquer status exceto `entregue`). */
export function isPedidoProntoNaoEntregue(n: {
  tipo_solicitacao?: string | null
  entrega_status?: string | null
}): boolean {
  if (!isPedidoPronto(n.tipo_solicitacao)) return false
  return (n.entrega_status ?? '').trim().toLowerCase() !== 'entregue'
}

/**
 * Pedido ainda em preparação / aguardando entregador.
 * Exclui etapas pós-coleta: `coletado`, `no_local`, `entregue`.
 */
export function isPedidoComTempoEspera(n: {
  tipo_solicitacao?: string | null
  entrega_status?: string | null
}): boolean {
  if (!isPedidoPronto(n.tipo_solicitacao)) return false
  const s = (n.entrega_status ?? '').trim().toLowerCase()
  return s !== 'coletado' && s !== 'no_local' && s !== 'entregue'
}

/**
 * `created_at` do pedido com espera mais antiga no card (badge), ou `null` se não há badge.
 */
export function createdAtEsperaMaisAntiga(
  notificacoes: Array<{
    tipo_solicitacao?: string | null
    entrega_status?: string | null
    created_at?: string | null
  }> | null | undefined,
): string | null {
  if (!Array.isArray(notificacoes) || notificacoes.length === 0) return null
  let oldestMs: number | null = null
  let oldestIso: string | null = null
  for (const n of notificacoes) {
    if (!isPedidoComTempoEspera(n) || !n.created_at) continue
    const t = new Date(n.created_at).getTime()
    if (Number.isNaN(t)) continue
    if (oldestMs == null || t < oldestMs) {
      oldestMs = t
      oldestIso = n.created_at
    }
  }
  return oldestIso
}

/** Minutos inteiros desde `created_at` (mín. 0). */
export function minutosDesdeCreatedAt(
  iso: string | null | undefined,
  nowMs: number = Date.now(),
): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return Math.max(0, Math.floor((nowMs - d.getTime()) / 60_000))
}

/**
 * Faixas de espera do pedido:
 * - top (verde): 0–19 min (até 20)
 * - razoavel (laranja): 20–27 min
 * - critico (vermelho): 28+ min (crítica a partir de ~35)
 */
export type TempoEsperaNivel = 'top' | 'razoavel' | 'critico'

export function nivelTempoEspera(minutos: number): TempoEsperaNivel {
  if (minutos < 20) return 'top'
  if (minutos <= 27) return 'razoavel'
  return 'critico'
}

export function classesBordaTempoEspera(nivel: TempoEsperaNivel): string {
  switch (nivel) {
    case 'top':
      return 'border-emerald-500 text-emerald-800 dark:border-emerald-400 dark:text-emerald-200'
    case 'razoavel':
      return 'border-orange-500 text-orange-800 dark:border-orange-400 dark:text-orange-200'
    case 'critico':
      return 'border-red-700 text-red-900 dark:border-red-500 dark:text-red-200'
  }
}

/** Tempo decorrido desde `created_at` (ex.: `5 min`, `2 h`). */
export function formatTempoDecorrido(
  iso: string | null | undefined,
  nowMs: number = Date.now(),
): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''

  const diffMs = Math.max(0, nowMs - d.getTime())
  const sec = Math.floor(diffMs / 1000)
  const min = Math.floor(sec / 60)
  const hr = Math.floor(min / 60)
  const day = Math.floor(hr / 24)

  if (sec < 60) return 'agora'
  if (min < 60) return `${min} min`
  if (hr < 24) return `${hr} h`
  if (day < 7) return `${day} d`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

/**
 * Som + modal de pedido novo:
 * - sem `id_cobranca` → toca
 * - com `id_cobranca` e `pagamento_realizado === true` → toca
 * - com `id_cobranca` e pagamento ainda false → não toca
 */
export function deveTocarSomPedidoNovo(n: {
  tipo_solicitacao?: string | null
  id_cobranca?: string | null
  pagamento_realizado?: boolean | null
}): boolean {
  if (!isPedidoPronto(n.tipo_solicitacao)) return false
  const cobranca =
    n.id_cobranca != null && String(n.id_cobranca).trim()
      ? String(n.id_cobranca).trim()
      : ''
  if (!cobranca) return true
  return n.pagamento_realizado === true
}

export function labelTipoSolicitacao(tipo: string | null | undefined): string {
  const t = (tipo ?? '').trim().toLowerCase()
  if (t === 'pedido_pronto') return 'Pedido pronto'
  if (t === 'transferencia_ia') return 'Transferência I.A.'
  if (!t) return 'Notificação'
  return tipo!.trim().replace(/_/g, ' ')
}

export function labelEntregaStatus(status: string | null | undefined): string {
  const t = (status ?? '').trim().toLowerCase()
  if (t === 'separacao') return 'Em separação'
  if (t === 'aguardando_entregador') return 'Aguardando entregador'
  if (t === 'coletado') return 'Coletado'
  if (t === 'no_local') return 'No local'
  if (t === 'entregue') return 'Entregue'
  if (!t) return 'Em separação'
  return status!.trim().replace(/_/g, ' ')
}

export function entregaStatusIndicadorClass(status: string | null | undefined): string {
  const t = (status ?? '').trim().toLowerCase()
  if (t === 'entregue') return 'bg-emerald-500'
  if (t === 'separacao' || !t) return 'bg-amber-500'
  return 'bg-sky-500'
}
