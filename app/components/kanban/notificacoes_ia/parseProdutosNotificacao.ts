export type ProdutoNotificacaoLinha = {
  nome: string
  qtd: number | null
  preco: number | null
  raw: string
}

/**
 * Formato típico vindo da I.A.:
 * `50X CIMENTO POTY 50 KG - R$ 54,00`
 * Pode vir vários itens no mesmo string separados por `\n`.
 */
export function parseProdutosNotificacao(
  produtos: string[] | null | undefined,
): ProdutoNotificacaoLinha[] {
  if (!Array.isArray(produtos) || produtos.length === 0) return []

  const linhas: string[] = []
  for (const bloco of produtos) {
    const text = typeof bloco === 'string' ? bloco : String(bloco ?? '')
    for (const parte of text.split(/\r?\n/)) {
      const t = parte.trim()
      if (t) linhas.push(t)
    }
  }

  return linhas.map((raw) => {
    const m = raw.match(
      /^\s*(\d+)\s*[xX×]\s*(.+?)\s*[-–—]\s*R\$\s*([\d.]+(?:,\d{1,2})?)\s*$/,
    )
    if (!m) {
      return { nome: raw, qtd: null, preco: null, raw }
    }

    const qtd = Number(m[1])
    const nome = (m[2] ?? '').trim()
    const precoStr = (m[3] ?? '').replace(/\./g, '').replace(',', '.')
    const preco = Number(precoStr)

    return {
      nome: nome || raw,
      qtd: Number.isFinite(qtd) ? qtd : null,
      preco: Number.isFinite(preco) ? preco : null,
      raw,
    }
  })
}

export function formatMoedaBr(valor: number | null | undefined): string {
  const n = valor != null && Number.isFinite(Number(valor)) ? Number(valor) : 0
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

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
