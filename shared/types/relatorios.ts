/**
 * Tipos da página de Relatórios (`/workspaces/[id]/relatorios`).
 * Fonte: `notificacoes_ia` com `tipo_solicitacao = pedido_pronto`.
 */

import type {
  KanbanNotificacaoProdutoItem,
  KanbanNotificacaoTotalOrcamento,
} from './kanban'

/** Linha para agregações do relatório. */
export type RelatorioPedidoProntoItem = {
  id: number
  forma_pagamento: string | null
  total_orcamento: KanbanNotificacaoTotalOrcamento
  pagamento_realizado: boolean
  created_at: string
  entrega_ou_retirada: string | null
  entrega_status: string
  coletado_at: string | null
  entregue_at: string | null
  canal_id: number
  canal_nome: string | null
  entregador_id: number | null
  entregador_nome: string | null
  produtos: Array<string | KanbanNotificacaoProdutoItem>
}

/** Resposta de `GET /api/relatorios`. */
export type RelatoriosListResponse = {
  data: RelatorioPedidoProntoItem[]
}

/** Agregado por forma de pagamento (quantidade). */
export type RelatorioPedidosPorForma = {
  forma: string
  quantidade: number
}

/** Agregado por forma de pagamento (valores). */
export type RelatorioValoresPorForma = {
  forma: string
  valor: number
}

/** Contagem + valor por rótulo genérico. */
export type RelatorioContagemValor = {
  label: string
  quantidade: number
  valor: number
}

/** Produto mais vendido. */
export type RelatorioProdutoVendido = {
  nome: string
  quantidade: number
}

/** Faixa horária (0–23). */
export type RelatorioHorarioPico = {
  hora: number
  label: string
  quantidade: number
}
