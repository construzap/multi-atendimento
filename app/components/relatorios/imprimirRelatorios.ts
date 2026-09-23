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

function linhasTabela(
  rows: Array<{ esq: string; dir: string }>,
  vazio: string,
): string {
  if (rows.length === 0) {
    return `<tr><td colspan="2" class="muted">${esc(vazio)}</td></tr>`
  }
  return rows
    .map(
      (r) =>
        `<tr><td>${esc(r.esq)}</td><td class="num">${esc(r.dir)}</td></tr>`,
    )
    .join('')
}

function secaoTabela(titulo: string, rowsHtml: string): string {
  return `
    <section class="bloco">
      <h2>${esc(titulo)}</h2>
      <table>
        <tbody>${rowsHtml}</tbody>
      </table>
    </section>`
}

function buildRelatorioHtml(input: RelatorioImpressaoInput): string {
  const loja = (input.lojaNome?.trim() || 'Relatórios').toUpperCase()
  const gerado = formatDataHora(input.geradoEm ?? new Date())
  const tempoMedio =
    input.tempoMedioEntregaMs != null
      ? formatDuracaoMs(input.tempoMedioEntregaMs)
      : '—'

  const kpiHtml = `
    <div class="kpis">
      <div class="kpi">
        <div class="kpi-label">Faturamento</div>
        <div class="kpi-valor">${esc(formatMoeda(input.faturamentoTotal))}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Ticket médio</div>
        <div class="kpi-valor">${esc(formatMoeda(input.ticketMedio))}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Pedidos</div>
        <div class="kpi-valor">${esc(String(input.totalPedidos))}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Tempo médio entrega</div>
        <div class="kpi-valor">${esc(tempoMedio)}</div>
        <div class="kpi-sub">${
          input.tempoMedioEntregaAmostra > 0
            ? esc(`${input.tempoMedioEntregaAmostra} entregue(s)`)
            : 'Sem amostra'
        }</div>
      </div>
    </div>`

  const pagamentos = [
    secaoTabela(
      'Pedidos por forma de pagamento',
      linhasTabela(
        input.pedidosPorForma.map((i) => ({
          esq: i.forma,
          dir: String(i.quantidade),
        })),
        'Nenhum dado',
      ),
    ),
    secaoTabela(
      'Valores por forma de pagamento',
      linhasTabela(
        input.valoresPorForma.map((i) => ({
          esq: i.forma,
          dir: formatMoeda(i.valor),
        })),
        'Nenhum dado',
      ),
    ),
    secaoTabela(
      'Pagos vs pendentes',
      linhasTabela(
        input.pagosVsPendentes.map((i) => ({
          esq: `${i.label} (${i.quantidade})`,
          dir: formatMoeda(i.valor),
        })),
        'Nenhum dado',
      ),
    ),
  ].join('')

  const operacao = [
    secaoTabela(
      'Entrega × retirada',
      linhasTabela(
        input.entregaVsRetirada.map((i) => ({
          esq: `${i.label} (${i.quantidade})`,
          dir: formatMoeda(i.valor),
        })),
        'Nenhum dado',
      ),
    ),
    secaoTabela(
      'Status da entrega',
      linhasTabela(
        input.statusDaEntrega.map((i) => ({
          esq: i.label,
          dir: String(i.quantidade),
        })),
        'Nenhum dado',
      ),
    ),
    secaoTabela(
      'Por canal',
      linhasTabela(
        input.porCanal.map((i) => ({
          esq: `${i.label} (${i.quantidade})`,
          dir: formatMoeda(i.valor),
        })),
        'Nenhum dado',
      ),
    ),
    secaoTabela(
      'Por entregador',
      linhasTabela(
        input.porEntregador.map((i) => ({
          esq: `${i.label} (${i.quantidade})`,
          dir: formatMoeda(i.valor),
        })),
        'Nenhum dado',
      ),
    ),
  ].join('')

  const produtosHorarios = [
    secaoTabela(
      'Produtos mais vendidos',
      linhasTabela(
        input.produtosMaisVendidos.map((i) => ({
          esq: i.nome,
          dir: String(i.quantidade),
        })),
        'Nenhum produto',
      ),
    ),
    secaoTabela(
      'Horários de pico',
      linhasTabela(
        input.horariosDePico.map((i) => ({
          esq: i.label,
          dir: String(i.quantidade),
        })),
        'Nenhum dado',
      ),
    ),
  ].join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Relatórios — ${esc(loja)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      color: #111;
      background: #fff;
      line-height: 1.4;
    }
    .wrap { max-width: 190mm; margin: 0 auto; }
    .topo { text-align: center; margin-bottom: 16px; }
    .loja {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .subtitulo {
      margin-top: 4px;
      font-size: 14px;
      font-weight: 700;
    }
    .meta {
      margin-top: 6px;
      color: #444;
      font-size: 11px;
    }
    .sep {
      border: 0;
      border-top: 1px dashed #999;
      margin: 14px 0;
    }
    .kpis {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .kpi {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 10px 12px;
    }
    .kpi-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #555;
      font-weight: 700;
    }
    .kpi-valor {
      margin-top: 4px;
      font-size: 16px;
      font-weight: 800;
    }
    .kpi-sub {
      margin-top: 2px;
      font-size: 10px;
      color: #666;
    }
    h2 {
      margin: 0 0 8px;
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px 18px;
    }
    .bloco {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    td {
      padding: 4px 0;
      border-bottom: 1px solid #eee;
      vertical-align: top;
    }
    td.num {
      text-align: right;
      font-weight: 700;
      white-space: nowrap;
      padding-left: 10px;
    }
    .muted { color: #666; font-style: italic; }
    .footer {
      margin-top: 18px;
      text-align: center;
      font-size: 10px;
      color: #666;
      text-transform: uppercase;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="topo">
      <div class="loja">${esc(loja)}</div>
      <div class="subtitulo">Relatório de pedidos prontos</div>
      <div class="meta">
        Período: ${esc(input.periodoLabel)} · Gerado em ${esc(gerado)}
      </div>
    </div>

    <hr class="sep" />
    ${kpiHtml}
    <hr class="sep" />

    <div class="grid-2">${pagamentos}</div>
    <hr class="sep" />
    <div class="grid-2">${operacao}</div>
    <hr class="sep" />
    <div class="grid-2">${produtosHorarios}</div>

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
    const popup = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700')
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
 * Abre o diálogo de impressão do navegador com o relatório consolidado.
 */
export function imprimirRelatorios(input: RelatorioImpressaoInput): void {
  if (!import.meta.client) return
  abrirImpressao(buildRelatorioHtml(input))
}
