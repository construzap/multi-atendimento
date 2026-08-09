import type { KanbanNotificacaoIa } from '#shared/types/kanban'
import {
  formatMoedaBr,
  normalizeTotalOrcamento,
  parseProdutosNotificacao,
  resolveTotalOrcamento,
  subtotalLinhaExibicao,
  type ProdutoNotificacaoLinha,
} from './parseProdutosNotificacao'

export type CupomPedidoImpressaoInput = {
  item: KanbanNotificacaoIa
  lojaNome?: string | null
  clienteNome?: string | null
  clienteTelefone?: string | null
  canalNome?: string | null
}

function esc(v: string | null | undefined): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDataCupom(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatPedidoId(id: number): string {
  const s = String(id)
  // Agrupa dígitos em blocos de 3 (estilo cupom), da direita p/ esquerda.
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

function somaProdutos(item: KanbanNotificacaoIa): number {
  const linhas = parseProdutosNotificacao(item.produtos)
  let soma = 0
  let tem = false
  for (const p of linhas) {
    const sub = subtotalLinhaExibicao(p, item.forma_pagamento)
    if (sub == null) continue
    tem = true
    soma += sub
  }
  if (tem) return soma
  return resolveTotalOrcamento(item.total_orcamento, item.forma_pagamento) ?? 0
}

function detalhePrecosItem(p: ProdutoNotificacaoLinha): string {
  const partes: string[] = []
  if (p.preco_vista != null) {
    const sub =
      p.subtotal_vista != null ? ` (${formatMoedaBr(p.subtotal_vista)})` : ''
    partes.push(`À vista: ${formatMoedaBr(p.preco_vista)}${sub}`)
  }
  if (p.preco_prazo != null) {
    const sub =
      p.subtotal_prazo != null ? ` (${formatMoedaBr(p.subtotal_prazo)})` : ''
    partes.push(`Prazo: ${formatMoedaBr(p.preco_prazo)}${sub}`)
  }
  if (partes.length === 0) return ''
  return `<div class="item-detalhe">${esc(partes.join(' · '))}</div>`
}

function buildCupomHtml(input: CupomPedidoImpressaoInput): string {
  const { item } = input
  const loja = (input.lojaNome?.trim() || 'PEDIDO').toUpperCase()
  const produtos = parseProdutosNotificacao(item.produtos)
  const totais = normalizeTotalOrcamento(item.total_orcamento)
  const soma = somaProdutos(item)
  const totalResolvido = resolveTotalOrcamento(item.total_orcamento, item.forma_pagamento)
  const total = totalResolvido != null ? totalResolvido : soma
  const entrega = item.entrega_ou_retirada?.trim() || ''
  const obs = item.observacoes?.trim() || ''
  const pagamento = item.forma_pagamento?.trim() || '—'
  const cliente = input.clienteNome?.trim() || '—'
  const telefone = input.clienteTelefone?.trim() || ''
  const canal = input.canalNome?.trim() || ''

  const itensHtml = produtos.length
    ? produtos
        .map((p) => {
          const qtd = p.qtd != null ? String(p.qtd) : '—'
          const sub = subtotalLinhaExibicao(p, item.forma_pagamento)
          const precoCell =
            sub != null
              ? formatMoedaBr(sub)
              : p.preco != null
                ? formatMoedaBr(p.preco)
                : '—'
          return `<tr>
            <td class="qtd">${esc(qtd)}</td>
            <td class="nome">
              <div class="item-nome">${esc(p.nome)}</div>
              ${detalhePrecosItem(p)}
            </td>
            <td class="preco">${esc(precoCell)}</td>
          </tr>`
        })
        .join('')
    : `<tr><td colspan="3" class="muted">Nenhum produto listado</td></tr>`

  const splitBase = total > 0 ? total : 0
  const split = [2, 3, 4, 5]
    .map((n) => {
      const parte = splitBase / n
      return `<div class="split-row"><span>${n} pessoas</span><span>..... ${esc(formatMoedaBr(parte))}</span></div>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Pedido ${esc(String(item.id))}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      color: #000;
      background: #fff;
    }
    .cupom {
      width: 72mm;
      max-width: 100%;
      margin: 0 auto;
      padding: 2mm 0;
    }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .muted { color: #333; }
    .loja {
      font-size: 16px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .pedido-num {
      font-size: 15px;
      font-weight: 800;
      margin-top: 6px;
    }
    .linha {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin: 3px 0;
    }
    .sep {
      border: 0;
      border-top: 1px dashed #000;
      margin: 10px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
    }
    td {
      vertical-align: top;
      padding: 3px 0;
    }
    td.qtd {
      width: 28px;
      font-weight: 700;
      padding-right: 6px;
    }
    td.nome { word-break: break-word; }
    td.preco {
      width: 68px;
      text-align: right;
      white-space: nowrap;
      padding-left: 6px;
      font-weight: 700;
    }
    .item-nome { font-weight: 700; }
    .item-detalhe {
      margin-top: 2px;
      font-size: 10px;
      color: #333;
      line-height: 1.35;
    }
    .totais .linha { margin: 2px 0; }
    .total-final {
      font-size: 14px;
      font-weight: 800;
      margin-top: 6px;
    }
    .split {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2px 8px;
      font-size: 11px;
      margin-top: 8px;
    }
    .split-row {
      display: flex;
      justify-content: space-between;
      gap: 4px;
    }
    .footer {
      margin-top: 12px;
      font-size: 10px;
      text-align: center;
      text-transform: uppercase;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="cupom">
    <div class="center">
      <div class="loja">${esc(loja)}</div>
      ${canal ? `<div class="muted" style="margin-top:4px">${esc(canal)}</div>` : ''}
      <div class="pedido-num">Pedido: ${esc(formatPedidoId(item.id))}</div>
      <div class="muted" style="margin-top:4px">${esc(formatDataCupom(item.created_at))}</div>
    </div>

    <hr class="sep" />

    <div class="linha"><span>Pagamento:</span><span class="bold">${esc(pagamento)}</span></div>
    ${entrega ? `<div class="linha"><span>Entrega/retirada:</span><span class="bold">${esc(entrega)}</span></div>` : ''}

    <hr class="sep" />

    <div><span class="bold">Cliente:</span> ${esc(cliente)}</div>
    ${telefone ? `<div><span class="bold">Telefone:</span> ${esc(telefone)}</div>` : ''}
    ${obs ? `<div style="margin-top:6px"><span class="bold">Observações:</span><br/>${esc(obs)}</div>` : ''}

    <hr class="sep" />

    <table>
      <tbody>
        ${itensHtml}
      </tbody>
    </table>

    <hr class="sep" />

    <div class="totais">
      <div class="linha"><span>Soma (pagamento):</span><span>${esc(formatMoedaBr(soma))}</span></div>
      <div class="linha"><span>Total à vista:</span><span>${esc(formatMoedaBr(totais.total_a_vista))}</span></div>
      <div class="linha"><span>Total a prazo:</span><span>${esc(formatMoedaBr(totais.total_a_prazo))}</span></div>
      <div class="linha total-final"><span>Total a pagar:</span><span>${esc(formatMoedaBr(totalResolvido ?? total))}</span></div>
    </div>

    <hr class="sep" />

    <div class="split">${split}</div>

    <div class="footer">Não tem valor fiscal</div>
  </div>
</body>
</html>`
}

/**
 * Abre o diálogo de impressão do navegador com o cupom do pedido.
 */
export function imprimirCupomPedido(input: CupomPedidoImpressaoInput): void {
  if (!import.meta.client) return

  const html = buildCupomHtml(input)
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'
  document.body.appendChild(iframe)

  const win = iframe.contentWindow
  const doc = iframe.contentDocument || win?.document
  if (!win || !doc) {
    iframe.remove()
    // Fallback: nova janela
    const popup = window.open('', '_blank', 'noopener,noreferrer,width=420,height=700')
    if (!popup) return
    popup.document.open()
    popup.document.write(html)
    popup.document.close()
    popup.focus()
    popup.onafterprint = () => popup.close()
    setTimeout(() => popup.print(), 250)
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    setTimeout(() => iframe.remove(), 400)
  }

  win.onafterprint = cleanup

  // Aguarda layout/fonts antes de imprimir
  setTimeout(() => {
    try {
      win.focus()
      win.print()
    } catch {
      cleanup()
    }
    // Fallback se o browser não disparar onafterprint
    setTimeout(cleanup, 60_000)
  }, 300)
}
