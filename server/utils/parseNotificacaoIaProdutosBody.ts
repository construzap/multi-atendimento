import { createError } from 'h3'
import type {
  KanbanNotificacaoProdutoItem,
  KanbanNotificacaoTotalOrcamento,
} from '#shared/types/kanban'

function strOrNull(v: unknown): string | null {
  if (v === undefined || v === null) return null
  const s = typeof v === 'string' ? v.trim() : String(v).trim()
  return s.length ? s : null
}

/**
 * Valida e normaliza `produtos[]` do body de criar/atualizar pedido pronto.
 */
export function parseNotificacaoIaProdutosBody(raw: unknown): {
  itens: KanbanNotificacaoProdutoItem[]
  total: KanbanNotificacaoTotalOrcamento
} {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe ao menos um produto.',
    })
  }

  const itens: KanbanNotificacaoProdutoItem[] = []
  let total_a_vista = 0
  let total_a_prazo = 0

  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      throw createError({ statusCode: 400, statusMessage: 'Produto inválido.' })
    }
    const o = item as Record<string, unknown>
    const nome = strOrNull(o.nome) ?? strOrNull(o.nome_produto)
    if (!nome) {
      throw createError({ statusCode: 400, statusMessage: 'Nome do produto é obrigatório.' })
    }

    const qtdRaw = o.qtd ?? o.quantidade
    const qtd =
      typeof qtdRaw === 'number'
        ? Math.trunc(qtdRaw)
        : Number.parseInt(String(qtdRaw ?? '').trim(), 10)
    if (!Number.isFinite(qtd) || qtd < 1) {
      throw createError({
        statusCode: 400,
        statusMessage: `Quantidade inválida para «${nome}».`,
      })
    }

    const parsePrecoOpcional = (precoRaw: unknown): number | null => {
      if (precoRaw === undefined || precoRaw === null || precoRaw === '') return null
      const n =
        typeof precoRaw === 'number'
          ? precoRaw
          : Number.parseFloat(String(precoRaw).replace(',', '.'))
      if (!Number.isFinite(n) || n < 0) {
        throw createError({
          statusCode: 400,
          statusMessage: `Preço inválido para «${nome}».`,
        })
      }
      return n
    }

    const precoVista =
      o.preco_vista !== undefined
        ? parsePrecoOpcional(o.preco_vista)
        : parsePrecoOpcional(o.preco)
    const precoPrazo = parsePrecoOpcional(o.preco_prazo)

    const subtotal_vista = precoVista != null ? qtd * precoVista : null
    const subtotal_prazo = precoPrazo != null ? qtd * precoPrazo : null
    if (subtotal_vista != null) total_a_vista += subtotal_vista
    if (subtotal_prazo != null) total_a_prazo += subtotal_prazo

    itens.push({
      quantidade: qtd,
      nome_produto: nome,
      preco_vista: precoVista,
      preco_prazo: precoPrazo,
      subtotal_vista,
      subtotal_prazo,
    })
  }

  const temAlgumPreco = itens.some(
    (i) => i.preco_vista != null || i.preco_prazo != null,
  )
  if (!temAlgumPreco) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe ao menos um preço (à vista ou a prazo) nos produtos.',
    })
  }

  return {
    itens,
    total: {
      total_a_vista: itens.every((i) => i.subtotal_vista == null) ? null : total_a_vista,
      total_a_prazo: itens.every((i) => i.subtotal_prazo == null) ? null : total_a_prazo,
    },
  }
}
