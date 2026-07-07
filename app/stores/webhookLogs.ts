import { defineStore } from 'pinia'
import type {
  DetalheWebhookExecucaoResponse,
  ListarWebhookExecucoesResponse,
  WebhookExecucaoResumo,
  WebhookExecucaoRow,
  WebhookExecucaoStatus,
} from '#shared/types/webhookExecucao'
import { mensagemErroFetch } from '~/stores/canais'

function localDatetimeToIso(value: string | null | undefined): string | null {
  const s = value?.trim()
  if (!s) return null
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

type WebhookLogsState = {
  execucoes: WebhookExecucaoResumo[]
  workspaceIdLoaded: number | null
  carregado: boolean
  pending: boolean
  error: string | null
  filtroStatus: WebhookExecucaoStatus | 'todos'
  filtroIdCanal: number | null
  /** Período (valores de `datetime-local`, ex.: `2026-06-30T14:00`). */
  filtroDe: string | null
  filtroAte: string | null
  total: number
  offset: number
  limit: number
  detalhes: Record<string, WebhookExecucaoRow & { canal_nome?: string | null }>
  pendingDetalhe: Record<string, boolean>
}

export const useWebhookLogsStore = defineStore('webhookLogs', {
  state: (): WebhookLogsState => ({
    execucoes: [],
    workspaceIdLoaded: null,
    carregado: false,
    pending: false,
    error: null,
    filtroStatus: 'todos',
    filtroIdCanal: null,
    filtroDe: null,
    filtroAte: null,
    total: 0,
    offset: 0,
    limit: 20,
    detalhes: {},
    pendingDetalhe: {},
  }),

  getters: {
    temExecucoesCarregadas(state): (workspaceId: number) => boolean {
      return (workspaceId: number) =>
        state.carregado && state.workspaceIdLoaded === workspaceId
    },
    execucaoDetalhe(state): (id: string) => (WebhookExecucaoRow & { canal_nome?: string | null }) | null {
      return (id: string) => state.detalhes[id] ?? null
    },
    detalheCarregando(state): (id: string) => boolean {
      return (id: string) => state.pendingDetalhe[id] === true
    },
  },

  actions: {
    invalidar() {
      this.execucoes = []
      this.workspaceIdLoaded = null
      this.carregado = false
      this.error = null
      this.total = 0
      this.offset = 0
      this.filtroDe = null
      this.filtroAte = null
      this.detalhes = {}
      this.pendingDetalhe = {}
    },

    async setFiltroStatus(status: WebhookExecucaoStatus | 'todos', workspaceId: number) {
      if (this.filtroStatus === status) return
      this.filtroStatus = status
      this.offset = 0
      this.carregado = false
      await this.fetchExecucoes(workspaceId, { force: true })
    },

    async setFiltroIdCanal(idCanal: number | null, workspaceId: number) {
      if (this.filtroIdCanal === idCanal) return
      this.filtroIdCanal = idCanal
      this.offset = 0
      this.carregado = false
      await this.fetchExecucoes(workspaceId, { force: true })
    },

    async setFiltroPeriodo(
      de: string | null,
      ate: string | null,
      workspaceId: number,
    ) {
      const deNorm = de?.trim() || null
      const ateNorm = ate?.trim() || null
      if (this.filtroDe === deNorm && this.filtroAte === ateNorm) return
      this.filtroDe = deNorm
      this.filtroAte = ateNorm
      this.offset = 0
      this.carregado = false
      await this.fetchExecucoes(workspaceId, { force: true })
    },

    async limparFiltroPeriodo(workspaceId: number) {
      if (!this.filtroDe && !this.filtroAte) return
      this.filtroDe = null
      this.filtroAte = null
      this.offset = 0
      this.carregado = false
      await this.fetchExecucoes(workspaceId, { force: true })
    },

    /**
     * Lista execuções do workspace. Reutiliza cache do Pinia quando já carregado
     * para o mesmo workspace e filtros (use `force: true` para buscar de novo).
     */
    async fetchExecucoes(
      workspaceId: number,
      opts?: { force?: boolean; offset?: number },
    ): Promise<WebhookExecucaoResumo[]> {
      const force = opts?.force === true
      const novoOffset = opts?.offset ?? this.offset

      if (
        !force &&
        this.temExecucoesCarregadas(workspaceId) &&
        novoOffset === this.offset
      ) {
        return this.execucoes
      }

      this.pending = true
      this.error = null

      const query: Record<string, string | number> = {
        workspace_id: workspaceId,
        limit: this.limit,
        offset: novoOffset,
      }
      if (this.filtroStatus !== 'todos') {
        query.status = this.filtroStatus
      }
      if (this.filtroIdCanal != null) {
        query.id_canal = this.filtroIdCanal
      }
      const deIso = localDatetimeToIso(this.filtroDe)
      const ateIso = localDatetimeToIso(this.filtroAte)
      if (deIso) query.de = deIso
      if (ateIso) query.ate = ateIso

      try {
        const data = await $fetch<ListarWebhookExecucoesResponse>('/api/logs/execucoes', {
          method: 'GET',
          query,
        })

        this.execucoes = data.execucoes ?? []
        this.total = data.total ?? this.execucoes.length
        this.offset = novoOffset
        this.workspaceIdLoaded = workspaceId
        this.carregado = true
        return this.execucoes
      } catch (err) {
        this.execucoes = []
        this.carregado = false
        this.workspaceIdLoaded = null
        this.total = 0
        this.error = mensagemErroFetch(err, 'Não foi possível carregar os logs de webhook.')
        throw err
      } finally {
        this.pending = false
      }
    },

    /**
     * Busca detalhe de uma execução. Retorna do cache se já existir.
     */
    async fetchDetalhe(
      workspaceId: number,
      id: string,
    ): Promise<WebhookExecucaoRow & { canal_nome?: string | null }> {
      const cached = this.detalhes[id]
      if (cached) return cached

      this.pendingDetalhe = { ...this.pendingDetalhe, [id]: true }

      try {
        const data = await $fetch<DetalheWebhookExecucaoResponse>(
          `/api/logs/execucoes/${encodeURIComponent(id)}`,
          {
            method: 'GET',
            query: { workspace_id: workspaceId },
          },
        )

        const execucao = data.execucao
        this.detalhes = { ...this.detalhes, [id]: execucao }
        return execucao
      } catch (err) {
        throw err
      } finally {
        const next = { ...this.pendingDetalhe }
        delete next[id]
        this.pendingDetalhe = next
      }
    },
  },
})
