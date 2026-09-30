import type {
  RelatorioContagemValor,
  RelatorioHorarioPico,
  RelatorioPedidosPorForma,
  RelatorioProdutoVendido,
  RelatorioValoresPorForma,
} from '#shared/types/relatorios'
import { formatDuracaoMs } from '~/stores/relatorios'

export type RelatorioImpressaoInput = {
  lojaNome?: string | null
  periodoLabel: string
  geradoEm?: Date
  totalPedidos: number
  faturamentoTotal: number
  ticketMedio: number
  tempoMedioEntregaMs: number | null
  tempoMedioEntregaAmostra: number
  pedidosPorForma: RelatorioPedidosPorForma[]
  valoresPorForma: RelatorioValoresPorForma[]
  pagosVsPendentes: RelatorioContagemValor[]
  entregaVsRetirada: RelatorioContagemValor[]
  statusDaEntrega: RelatorioContagemValor[]
  porCanal: RelatorioContagemValor[]
  porEntregador: RelatorioContagemValor[]
  produtosMaisVendidos: RelatorioProdutoVendido[]
  horariosDePico: RelatorioHorarioPico[]
}

function esc(v: string | null | undefined): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor)
}

function formatDataHora(d: Date): string {
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Linha label …… valor (estilo cupom térmico). */
function linha(esq: string, dir: string, boldDir = true): string {
  return `<div class="linha">
    <span class="esq">${esc(esq)}</span>
    <span class="dir${boldDir ? ' bold' : ''}">${esc(dir)}</span>
  </div>`
}

function secao(titulo: string, linhasHtml: string, vazio: string): string {
  const corpo = linhasHtml.trim()
    ? linhasHtml
    : `<div class="muted">${esc(vazio)}</div>`
  return `
    <div class="bloco">
      <div class="titulo-secao">${esc(titulo)}</div>
      ${corpo}
    </div>`
}

function buildRelatorioHtml(input: RelatorioImpressaoInput): string {
  const loja = (input.lojaNome?.trim() || 'Relatórios').toUpperCase()
  const gerado = formatDataHora(input.geradoEm ?? new Date())
  const tempoMedio =
    input.tempoMedioEntregaMs != null
      ? formatDuracaoMs(input.tempoMedioEntregaMs)
      : '—'

  const kpis = [
    linha('Faturamento', formatMoeda(input.faturamentoTotal)),
    linha('Ticket médio', formatMoeda(input.ticketMedio)),
    linha('Pedidos', String(input.totalPedidos)),
    linha('Tempo médio entrega', tempoMedio),
    input.tempoMedioEntregaAmostra > 0
      ? `<div class="muted" style="margin-top:2px">${esc(
          `${input.tempoMedioEntregaAmostra} pedido(s) entregue(s)`,
        )}</div>`
      : '',
  ].join('')

  const pedidosForma = input.pedidosPorForma
    .map((i) => linha(i.forma, String(i.quantidade)))
    .join('')

  const valoresForma = input.valoresPorForma
    .map((i) => linha(i.forma, formatMoeda(i.valor)))
    .join('')

  const pagos = input.pagosVsPendentes
    .map((i) => linha(`${i.label} (${i.quantidade})`, formatMoeda(i.valor)))
    .join('')

  const entregaRetirada = input.entregaVsRetirada
    .map((i) => linha(`${i.label} (${i.quantidade})`, formatMoeda(i.valor)))
    .join('')

  const status = input.statusDaEntrega
    .map((i) => linha(i.label, String(i.quantidade)))
    .join('')

  const canais = input.porCanal
    .map((i) => linha(`${i.label} (${i.quantidade})`, formatMoeda(i.valor)))
    .join('')

  const entregadores = input.porEntregador
    .map((i) => linha(`${i.label} (${i.quantidade})`, formatMoeda(i.valor)))
    .join('')

  const produtos = input.produtosMaisVendidos
    .map((i) => linha(i.nome, String(i.quantidade)))
    .join('')

  const horarios = input.horariosDePico
    .map((i) => linha(i.label, String(i.quantidade)))
    .join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Relatório — ${esc(loja)}</title>
  <style>
    @page { size: 80mm auto; margin: 2mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 80mm;
      max-width: 80mm;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      color: #000;
      background: #fff;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .cupom {
      width: 76mm;
      max-width: 100%;
      margin: 0 auto;
      padding: 2mm 1mm;
    }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .muted { color: #333; font-size: 11px; }
    .loja {
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      word-break: break-word;
    }
    .subtitulo {
      margin-top: 4px;
      font-size: 12px;
      font-weight: 700;
    }
    .meta {
      margin-top: 4px;
      font-size: 10px;
      color: #333;
      word-break: break-word;
    }
    .sep {
      border: 0;
      border-top: 1px dashed #000;
      margin: 8px 0;
    }
    .bloco { margin: 0; }
    .titulo-secao {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      margin: 0 0 4px;
    }
    .linha {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 6px;
      margin: 2px 0;
    }
    .esq {
      flex: 1 1 auto;
      min-width: 0;
      word-break: break-word;
    }
    .dir {
      flex: 0 0 auto;
      text-align: right;
      white-space: nowrap;
    }
    .footer {
      margin-top: 10px;
      font-size: 10px;
      text-align: center;
      text-transform: uppercase;
    }
    @media print {
      html, body { width: 80mm; }
      .cupom { width: 76mm; }
    }
  </style>
</head>
<body>
  <div class="cupom">
    <div class="center">
      <div class="loja">${esc(loja)}</div>
      <div class="subtitulo">Relatório de pedidos prontos</div>
      <div class="meta">Período: ${esc(input.periodoLabel)}</div>
      <div class="meta">Gerado em ${esc(gerado)}</div>
    </div>

    <hr class="sep" />

    <div class="bloco">
      <div class="titulo-secao">Resumo</div>
      ${kpis}
    </div>

    <hr class="sep" />
    ${secao('Pedidos por forma de pagamento', pedidosForma, 'Nenhum dado')}

    <hr class="sep" />
    ${secao('Valores por forma de pagamento', valoresForma, 'Nenhum dado')}

    <hr class="sep" />
    ${secao('Pagos vs pendentes', pagos, 'Nenhum dado')}

    <hr class="sep" />
    ${secao('Entrega × retirada', entregaRetirada, 'Nenhum dado')}

    <hr class="sep" />
    ${secao('Status da entrega', status, 'Nenhum dado')}

    <hr class="sep" />
    ${secao('Por canal', canais, 'Nenhum dado')}

    <hr class="sep" />
    ${secao('Por entregador', entregadores, 'Nenhum dado')}

    <hr class="sep" />
    ${secao('Produtos mais vendidos', produtos, 'Nenhum produto')}

    <hr class="sep" />
    ${secao('Horários de pico', horarios, 'Nenhum dado')}

    <div class="footer">Relatório interno · Sem valor fiscal</div>
  </div>
</body>
</html>`
}

function abrirImpressao(html: string): void {
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

  setTimeout(() => {
    try {
      win.focus()
      win.print()
    } catch {
      cleanup()
    }
    setTimeout(cleanup, 60_000)
  }, 300)
}

/**
 * Abre o diálogo de impressão no formato térmico 80mm (mesmo padrão do cupom).
 */
export function imprimirRelatorios(input: RelatorioImpressaoInput): void {
  if (!import.meta.client) return
  abrirImpressao(buildRelatorioHtml(input))
}
