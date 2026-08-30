/**
 * Produtos em `notificacoes_ia.produtos` (jsonb).
 * Formato novo (N8N / app) e legado (strings `10X NOME - R$ 54,00`).
 */

import type {
  KanbanNotificacaoIa,
  KanbanNotificacaoProdutoItem,
  KanbanNotificacaoTotalOrcamento,
} from '../types/kanban'

/** Item normalizado para UI / cupom. */
export type ProdutoNotificacaoLinha = {
  nome: string
  qtd: number | null
  /** Preço unitário “principal” (à vista, ou legado). */
  preco: number | null
  preco_vista: number | null
  preco_prazo: number | null
  subtotal_vista: number | null
  subtotal_prazo: number | null
  raw: string
}

function numOrNull(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  const s = String(raw).trim()
  if (!s) return null
  if (/^\d+[.,]\d+$/.test(s) || /^\d+$/.test(s)) {
    const v = Number(s.replace(',', '.'))
    return Number.isFinite(v) ? v : null
  }
  if (s.includes(',')) {
    const v = Number(s.replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(v) ? v : null
  }
  const v = Number(s)
  return Number.isFinite(v) ? v : null
}

function intOrNull(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? Math.trunc(raw) : Number.parseInt(String(raw).trim(), 10)
  return Number.isFinite(n) ? n : null
}

/** Pagamento a prazo / cartão → usa preço a prazo. */
export function formaPagamentoEhAPrazo(forma: string | null | undefined): boolean {
  const f = (forma ?? '').trim().toLowerCase()
  if (!f) return false
  return /cart[aã]o|prazo|cr[eé]dito|parcel/i.test(f)
}

/**
 * Normaliza `total_orcamento` (jsonb) para o Pinia / API:
 * - `{ total_a_vista, total_a_prazo }` (null permanece null)
 * - number legado → ambos iguais
 * - string JSON ou número em string
 */
export function normalizeTotalOrcamento(raw: unknown): KanbanNotificacaoTotalOrcamento {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return { total_a_vista: raw, total_a_prazo: raw }
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return normalizeTotalOrcamento(JSON.parse(raw) as unknown)
    } catch {
      const n = numOrNull(raw)
      return { total_a_vista: n, total_a_prazo: n }
    }
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>
    return {
      total_a_vista: numOrNull(o.total_a_vista ?? o.total_vista),
      total_a_prazo: numOrNull(o.total_a_prazo ?? o.total_prazo),
    }
  }
  return { total_a_vista: null, total_a_prazo: null }
}

/** Escolhe o total a exibir conforme a forma de pagamento (`null` se ausente). */
export function resolveTotalOrcamento(
  raw: unknown,
  formaPagamento?: string | null,
): number | null {
  const t = normalizeTotalOrcamento(raw)
  if (formaPagamentoEhAPrazo(formaPagamento)) return t.total_a_prazo
  return t.total_a_vista
}

function isProdutoObjeto(p: unknown): p is Record<string, unknown> {
  return !!p && typeof p === 'object' && !Array.isArray(p)
}

/** Mantém objetos estruturados; strings legadas intactas. */
export function normalizeProdutosRaw(raw: unknown): Array<string | KanbanNotificacaoProdutoItem> {
  let list: unknown[] = []
  if (Array.isArray(raw)) {
    list = raw
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) list = parsed
      else return []
    } catch {
      return raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
    }
  } else {
    return []
  }

  const out: Array<string | KanbanNotificacaoProdutoItem> = []
  for (const item of list) {
    if (typeof item === 'string') {
      const t = item.trim()
      if (t) out.push(t)
      continue
    }
    if (!isProdutoObjeto(item)) continue

    const nome =
      (typeof item.nome_produto === 'string' && item.nome_produto.trim()) ||
      (typeof item.nome === 'string' && item.nome.trim()) ||
      ''
    if (!nome) continue

    const quantidade = intOrNull(item.quantidade ?? item.qtd) ?? 1
    // Não substituir null: se veio null, permanece null.
    const preco_vista =
      item.preco_vista !== undefined
        ? numOrNull(item.preco_vista)
        : numOrNull(item.preco)
    const preco_prazo = numOrNull(item.preco_prazo)
    const subtotal_vista =
      item.subtotal_vista !== undefined
        ? numOrNull(item.subtotal_vista)
        : preco_vista != null
          ? quantidade * preco_vista
          : null
    const subtotal_prazo =
      item.subtotal_prazo !== undefined
        ? numOrNull(item.subtotal_prazo)
        : preco_prazo != null
          ? quantidade * preco_prazo
          : null

    out.push({
      quantidade: Math.max(1, quantidade),
      nome_produto: nome,
      preco_vista,
      preco_prazo,
      subtotal_vista,
      subtotal_prazo,
    })
  }
  return out
}

function parseLinhaString(raw: string): ProdutoNotificacaoLinha {
  const m = raw.match(
    /^\s*(\d+)\s*[xX×]\s*(.+?)\s*[-–—]\s*R\$\s*([\d.]+(?:,\d{1,2})?)\s*$/,
  )
  if (!m) {
    return {
      nome: raw,
      qtd: null,
      preco: null,
      preco_vista: null,
      preco_prazo: null,
      subtotal_vista: null,
      subtotal_prazo: null,
      raw,
    }
  }

  const qtd = Number(m[1])
  const nome = (m[2] ?? '').trim()
  const precoStr = (m[3] ?? '').replace(/\./g, '').replace(',', '.')
  const preco = Number(precoStr)
  const precoOk = Number.isFinite(preco) ? preco : null
  const qtdOk = Number.isFinite(qtd) ? qtd : null

  return {
    nome: nome || raw,
    qtd: qtdOk,
    preco: precoOk,
    preco_vista: precoOk,
    preco_prazo: precoOk,
    subtotal_vista: precoOk != null && qtdOk != null ? precoOk * qtdOk : null,
    subtotal_prazo: precoOk != null && qtdOk != null ? precoOk * qtdOk : null,
    raw,
  }
}

/**
 * Converte `produtos` (objetos novos ou strings legadas) em linhas para UI.
 */
export function parseProdutosNotificacao(
  produtos: Array<string | KanbanNotificacaoProdutoItem> | null | undefined,
): ProdutoNotificacaoLinha[] {
  const normalized = normalizeProdutosRaw(produtos)
  if (normalized.length === 0) return []

  const linhas: ProdutoNotificacaoLinha[] = []
  for (const item of normalized) {
    if (typeof item === 'string') {
      for (const parte of item.split(/\r?\n/)) {
        const t = parte.trim()
        if (t) linhas.push(parseLinhaString(t))
      }
      continue
    }

    linhas.push({
      nome: item.nome_produto,
      qtd: item.quantidade,
      preco: item.preco_vista,
      preco_vista: item.preco_vista,
      preco_prazo: item.preco_prazo,
      subtotal_vista: item.subtotal_vista,
      subtotal_prazo: item.subtotal_prazo,
      raw: `${item.quantidade}X ${item.nome_produto}`,
    })
  }
  return linhas
}

/** Subtotal a exibir conforme forma de pagamento (não troca vista↔prazo quando null). */
export function subtotalLinhaExibicao(
  p: ProdutoNotificacaoLinha,
  formaPagamento?: string | null,
): number | null {
  if (formaPagamentoEhAPrazo(formaPagamento)) {
    if (p.subtotal_prazo != null) return p.subtotal_prazo
    if (p.preco_prazo != null && p.qtd != null) return p.preco_prazo * p.qtd
    return null
  }
  if (p.subtotal_vista != null) return p.subtotal_vista
  if (p.preco_vista != null && p.qtd != null) return p.preco_vista * p.qtd
  if (p.preco != null && p.qtd != null) return p.preco * p.qtd
  return p.preco
}

export function formatMoedaBr(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(Number(valor))) return '—'
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Status inicial de pedidos novos aguardando aceite no kanban. */
export const ENTREGA_STATUS_SEPARACAO = 'separacao' as const

/** Colunas retornadas ao mapear / selecionar `notificacoes_ia`. */
export const NOTIFICACAO_IA_SELECT =
  'id, produtos, total_orcamento, observacoes, forma_pagamento, latitude, longitude, tipo_solicitacao, created_at, updated_at, entrega_ou_retirada, endereco, id_cobranca, pagamento_realizado, token_entrega, entrega_status, nome, fone'

export function normalizeEntregaStatus(raw: unknown): string {
  const s = raw != null ? String(raw).trim() : ''
  return s || ENTREGA_STATUS_SEPARACAO
}

/** Mapeia linha do Supabase → `KanbanNotificacaoIa` (view, APIs). */
export function mapNotificacaoIaRow(row: Record<string, unknown>): KanbanNotificacaoIa {
  const forma_pagamento =
    row.forma_pagamento != null ? String(row.forma_pagamento) : null
  const produtos = normalizeProdutosRaw(row.produtos)
  const total_orcamento = normalizeTotalOrcamento(row.total_orcamento)
  const idCobrancaRaw =
    row.id_cobranca != null ? String(row.id_cobranca).trim() : ''
  const tokenRaw =
    row.token_entrega != null ? String(row.token_entrega).trim().toLowerCase() : ''

  return {
    id: typeof row.id === 'number' ? row.id : Number(row.id),
    produtos,
    total_orcamento,
    observacoes: row.observacoes != null ? String(row.observacoes) : null,
    forma_pagamento,
    latitude:
      row.latitude != null && Number.isFinite(Number(row.latitude))
        ? Number(row.latitude)
        : null,
    longitude:
      row.longitude != null && Number.isFinite(Number(row.longitude))
        ? Number(row.longitude)
        : null,
    tipo_solicitacao:
      row.tipo_solicitacao != null ? String(row.tipo_solicitacao) : null,
    created_at:
      row.created_at != null ? String(row.created_at) : new Date().toISOString(),
    updated_at:
      row.updated_at != null ? String(row.updated_at) : new Date().toISOString(),
    entrega_ou_retirada:
      row.entrega_ou_retirada != null ? String(row.entrega_ou_retirada) : null,
    entrega_status: normalizeEntregaStatus(row.entrega_status),
    endereco: (() => {
      const t = row.endereco != null ? String(row.endereco).trim() : ''
      return t || null
    })(),
    id_cobranca: idCobrancaRaw || null,
    pagamento_realizado: row.pagamento_realizado === true,
    token_entrega: tokenRaw || null,
  }
}
