import type { KanbanNotificacaoIa } from '#shared/types/kanban'
import {
  formatMoedaBr,
  parseProdutosNotificacao,
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
    if (p.preco == null) continue
    tem = true
    soma += p.qtd != null ? p.preco * p.qtd : p.preco
  }
  if (tem) return soma
  return Number(item.total_orcamento) || 0
}

function buildCupomHtml(input: CupomPedidoImpressaoInput): string {
  const { item } = input
  const loja = (input.lojaNome?.trim() || 'PEDIDO').toUpperCase()
  const produtos = parseProdutosNotificacao(item.produtos)
  const soma = somaProdutos(item)
  const total = Number(item.total_orcamento) || soma
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
          const precoUnit =
            p.preco != null ? formatMoedaBr(p.preco) : '—'
          return `<tr>
            <td class="qtd">${esc(qtd)}</td>
            <td class="nome">${esc(p.nome)}</td>
            <td class="preco">${esc(precoUnit)}</td>
          </tr>`
        })
        .join('')
    : `<tr><td colspan="3" class="muted">Nenhum produto listado</td></tr>`

  const split = [2, 3, 4, 5]
    .map((n) => {
      const parte = total / n
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
      <div class="linha"><span>Soma dos produtos:</span><span>${esc(formatMoedaBr(soma))}</span></div>
      <div class="linha total-final"><span>Total a pagar:</span><span>${esc(formatMoedaBr(total))}</span></div>
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
