import { defineStore } from 'pinia'
import type {
  RelatorioContagemValor,
  RelatorioHorarioPico,
  RelatorioPedidoProntoItem,
  RelatorioPedidosPorForma,
  RelatorioProdutoVendido,
  RelatoriosListResponse,
  RelatorioValoresPorForma,
} from '#shared/types/relatorios'
import {
  parseProdutosNotificacao,
  resolveTotalOrcamento,
} from '#shared/utils/notificacaoIaProdutos'
import { mensagemErroFetch } from '~/stores/canais'

/**
 * Agrupa rótulos livres de `forma_pagamento` em buckets estáveis para o relatório.
 * Ex.: "Cartão de crédito" / "Cartão de débito" → "Cartão".
 */
export function normalizarFormaPagamentoRelatorio(forma: string | null | undefined): string {
  const f = (forma ?? '').trim().toLowerCase()
  if (!f) return 'Sem forma'
  if (/pix/i.test(f)) return 'Pix'
  if (/dinheiro|esp[eé]cie/i.test(f)) return 'Dinheiro'
  if (/cart[aã]o|cr[eé]dito|d[eé]bito|prazo|parcel/i.test(f)) return 'Cartão'
  if (/vista|à vista|a vista/i.test(f)) return 'À vista'
  const raw = (forma ?? '').trim()
  return raw || 'Sem forma'
}

export function labelEntregaOuRetirada(raw: string | null | undefined): string {
  const t = (raw ?? '').trim().toLowerCase()
  if (!t) return 'Não informado'
  if (/retir/i.test(t)) return 'Retirada'
  if (/entreg/i.test(t)) return 'Entrega'
  return (raw ?? '').trim() || 'Não informado'
}

export function labelStatusEntregaRelatorio(status: string | null | undefined): string {
  const t = (status ?? '').trim().toLowerCase()
  if (t === 'separacao' || !t) return 'Em separação'
  if (t === 'aguardando_entregador') return 'Aguardando entregador'
  if (t === 'coletado') return 'Coletado'
  if (t === 'no_local') return 'No local'
  if (t === 'entregue') return 'Entregue'
  return (status ?? '').trim().replace(/_/g, ' ') || 'Em separação'
}

export function formatDuracaoMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const totalMin = Math.round(ms / 60_000)
  if (totalMin < 1) return '< 1 min'
  if (totalMin < 60) return `${totalMin} min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

function valorPedido(item: RelatorioPedidoProntoItem): number {
  const n = resolveTotalOrcamento(item.total_orcamento, item.forma_pagamento)
  return n != null && Number.isFinite(n) ? n : 0
}

/** `YYYY-MM-DD` no fuso local. */
export function formatDateInputLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dateInputStartToIso(value: string | null | undefined): string | null {
  const s = value?.trim()
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0)
  if (Number.isNaN(dt.getTime())) return null
  return dt.toISOString()
}

function dateInputEndToIso(value: string | null | undefined): string | null {
  const s = value?.trim()
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  const dt = new Date(y, m - 1, d, 23, 59, 59, 999)
  if (Number.isNaN(dt.getTime())) return null
  return dt.toISOString()
}

function sortContagemValor(a: RelatorioContagemValor, b: RelatorioContagemValor) {
  return b.quantidade - a.quantidade || a.label.localeCompare(b.label, 'pt-BR')
}

export const useRelatoriosStore = defineStore('relatorios', {
  state: () => ({
    items: [] as RelatorioPedidoProntoItem[],
    listPending: false,
    listError: null as string | null,
    loadedWorkspaceId: null as number | null,
    /** Valores de `input[type=date]` (`YYYY-MM-DD`). */
    filtroDe: null as string | null,
    filtroAte: null as string | null,
  }),

  getters: {
    periodoAtivo(state): boolean {
      return Boolean(state.filtroDe || state.filtroAte)
    },

    faturamentoTotal(state): number {
      return state.items.reduce((acc, item) => acc + valorPedido(item), 0)
    },

    totalPedidos(state): number {
      return state.items.length
    },

    ticketMedio(): number {
      const total = this.totalPedidos
      if (total < 1) return 0
      return this.faturamentoTotal / total
    },

    pedidosPorFormaPagamento(state): RelatorioPedidosPorForma[] {
      const map = new Map<string, number>()
      for (const item of state.items) {
        const forma = normalizarFormaPagamentoRelatorio(item.forma_pagamento)
        map.set(forma, (map.get(forma) ?? 0) + 1)
      }
      return Array.from(map.entries())
        .map(([forma, quantidade]) => ({ forma, quantidade }))
        .sort((a, b) => b.quantidade - a.quantidade || a.forma.localeCompare(b.forma, 'pt-BR'))
    },

    valoresPorFormaPagamento(state): RelatorioValoresPorForma[] {
      const map = new Map<string, number>()
      for (const item of state.items) {
        const forma = normalizarFormaPagamentoRelatorio(item.forma_pagamento)
        map.set(forma, (map.get(forma) ?? 0) + valorPedido(item))
      }
      return Array.from(map.entries())
        .map(([forma, valor]) => ({ forma, valor }))
        .sort((a, b) => b.valor - a.valor || a.forma.localeCompare(b.forma, 'pt-BR'))
    },

    pagosVsPendentes(state): RelatorioContagemValor[] {
      let pagosQ = 0
      let pagosV = 0
      let pendQ = 0
      let pendV = 0
      for (const item of state.items) {
        const v = valorPedido(item)
        if (item.pagamento_realizado) {
          pagosQ += 1
          pagosV += v
        } else {
          pendQ += 1
          pendV += v
        }
      }
      return [
        { label: 'Pagos', quantidade: pagosQ, valor: pagosV },
        { label: 'Pendentes', quantidade: pendQ, valor: pendV },
      ]
    },

    entregaVsRetirada(state): RelatorioContagemValor[] {
      const map = new Map<string, { quantidade: number; valor: number }>()
      for (const item of state.items) {
        const label = labelEntregaOuRetirada(item.entrega_ou_retirada)
        const cur = map.get(label) ?? { quantidade: 0, valor: 0 }
        cur.quantidade += 1
        cur.valor += valorPedido(item)
        map.set(label, cur)
      }
      return Array.from(map.entries())
        .map(([label, v]) => ({ label, ...v }))
        .sort(sortContagemValor)
    },

    statusDaEntrega(state): RelatorioContagemValor[] {
      const map = new Map<string, { quantidade: number; valor: number }>()
      for (const item of state.items) {
        const label = labelStatusEntregaRelatorio(item.entrega_status)
        const cur = map.get(label) ?? { quantidade: 0, valor: 0 }
        cur.quantidade += 1
        cur.valor += valorPedido(item)
        map.set(label, cur)
      }
      return Array.from(map.entries())
        .map(([label, v]) => ({ label, ...v }))
        .sort(sortContagemValor)
    },

    /** Média created_at → entregue_at (ms). `null` se nenhum pedido entregue com datas. */
    tempoMedioEntregaMs(state): number | null {
      let soma = 0
      let n = 0
      for (const item of state.items) {
        if (!item.entregue_at || !item.created_at) continue
        const ini = new Date(item.created_at).getTime()
        const fim = new Date(item.entregue_at).getTime()
        if (!Number.isFinite(ini) || !Number.isFinite(fim) || fim < ini) continue
        soma += fim - ini
        n += 1
      }
      if (n < 1) return null
      return soma / n
    },

    tempoMedioEntregaAmostra(state): number {
      let n = 0
      for (const item of state.items) {
        if (!item.entregue_at || !item.created_at) continue
        const ini = new Date(item.created_at).getTime()
        const fim = new Date(item.entregue_at).getTime()
        if (!Number.isFinite(ini) || !Number.isFinite(fim) || fim < ini) continue
        n += 1
      }
      return n
    },

    porCanal(state): RelatorioContagemValor[] {
      const map = new Map<string, { quantidade: number; valor: number }>()
      for (const item of state.items) {
        const label =
          item.canal_nome?.trim() ||
          (item.canal_id > 0 ? `Canal #${item.canal_id}` : 'Sem canal')
        const cur = map.get(label) ?? { quantidade: 0, valor: 0 }
        cur.quantidade += 1
        cur.valor += valorPedido(item)
        map.set(label, cur)
      }
      return Array.from(map.entries())
        .map(([label, v]) => ({ label, ...v }))
        .sort(sortContagemValor)
    },

    produtosMaisVendidos(state): RelatorioProdutoVendido[] {
      const map = new Map<string, { nome: string; quantidade: number }>()
      for (const item of state.items) {
        for (const linha of parseProdutosNotificacao(item.produtos)) {
          const nome = (linha.nome ?? '').trim()
          if (!nome) continue
          const key = nome.toLowerCase()
          const qtd = linha.qtd != null && Number.isFinite(linha.qtd) ? Math.max(0, linha.qtd) : 1
          const cur = map.get(key)
          if (cur) cur.quantidade += qtd
          else map.set(key, { nome, quantidade: qtd })
        }
      }
      return Array.from(map.values())
        .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, 'pt-BR'))
        .slice(0, 15)
    },

    horariosDePico(state): RelatorioHorarioPico[] {
      const counts = Array.from({ length: 24 }, () => 0)
      for (const item of state.items) {
        if (!item.created_at) continue
        const d = new Date(item.created_at)
        if (Number.isNaN(d.getTime())) continue
        counts[d.getHours()]! += 1
      }
      return counts
        .map((quantidade, hora) => ({
          hora,
          label: `${String(hora).padStart(2, '0')}h`,
          quantidade,
        }))
        .filter((x) => x.quantidade > 0)
        .sort((a, b) => b.quantidade - a.quantidade || a.hora - b.hora)
    },

    porEntregador(state): RelatorioContagemValor[] {
      const map = new Map<string, { quantidade: number; valor: number }>()
      for (const item of state.items) {
        const label =
          item.entregador_nome?.trim() ||
          (item.entregador_id != null ? `Entregador #${item.entregador_id}` : 'Sem entregador')
        const cur = map.get(label) ?? { quantidade: 0, valor: 0 }
        cur.quantidade += 1
        cur.valor += valorPedido(item)
        map.set(label, cur)
      }
      return Array.from(map.entries())
        .map(([label, v]) => ({ label, ...v }))
        .sort(sortContagemValor)
    },
  },

  actions: {
    reset() {
      this.items = []
      this.listPending = false
      this.listError = null
      this.loadedWorkspaceId = null
      this.filtroDe = null
      this.filtroAte = null
    },

    async setFiltroPeriodo(de: string | null, ate: string | null, workspaceId: number) {
      const deNorm = de?.trim() || null
      const ateNorm = ate?.trim() || null
      if (this.filtroDe === deNorm && this.filtroAte === ateNorm) {
        await this.fetchList(workspaceId, { force: true })
        return
      }
      this.filtroDe = deNorm
      this.filtroAte = ateNorm
      await this.fetchList(workspaceId, { force: true })
    },

    async limparFiltroPeriodo(workspaceId: number) {
      if (!this.filtroDe && !this.filtroAte) return
      this.filtroDe = null
      this.filtroAte = null
      await this.fetchList(workspaceId, { force: true })
    },

    async aplicarAtalho(
      preset: 'hoje' | 'ontem' | '7dias' | '30dias',
      workspaceId: number,
    ) {
      const agora = new Date()
      const hoje = formatDateInputLocal(agora)

      if (preset === 'hoje') {
        await this.setFiltroPeriodo(hoje, hoje, workspaceId)
        return
      }
      if (preset === 'ontem') {
        const ontem = new Date(agora)
        ontem.setDate(ontem.getDate() - 1)
        const s = formatDateInputLocal(ontem)
        await this.setFiltroPeriodo(s, s, workspaceId)
        return
      }
      const dias = preset === '7dias' ? 6 : 29
      const inicio = new Date(agora)
      inicio.setDate(inicio.getDate() - dias)
      await this.setFiltroPeriodo(formatDateInputLocal(inicio), hoje, workspaceId)
    },

    async fetchList(workspaceId: number, { force = false } = {}) {
      if (
        !force &&
        this.loadedWorkspaceId === workspaceId &&
        !this.listError &&
        !this.listPending
      ) {
        return
      }

      this.listPending = true
      this.listError = null
      try {
        const query: Record<string, string | number> = {
          workspace_id: workspaceId,
        }
        const deIso = dateInputStartToIso(this.filtroDe)
        const ateIso = dateInputEndToIso(this.filtroAte)
        if (deIso) query.de = deIso
        if (ateIso) query.ate = ateIso

        const res = await $fetch<RelatoriosListResponse>('/api/relatorios', { query })
        this.items = res.data ?? []
        this.loadedWorkspaceId = workspaceId
      } catch (err) {
        this.listError = mensagemErroFetch(err, 'Não foi possível carregar os relatórios.')
        throw err
      } finally {
        this.listPending = false
      }
    },

    async ensureListLoaded(workspaceId: number) {
      if (this.loadedWorkspaceId === workspaceId && !this.listError) return
      await this.fetchList(workspaceId)
    },
  },
})
