import { defineStore } from 'pinia'
import type {
  AgendamentoDestinatarioConversa,
  AgendamentoDestinatariosListResponse,
  AgendamentoMensagemListItem,
  AgendamentoMensagemListResponse,
} from '#shared/types/agendamentoMensagens'
import type { AgendamentoDiaItem, ContatoDestinoUi } from '~/components/agendamento-de-mensagem/types'

const PAGE_SIZE_FETCH = 200
const MAX_PAGES = 80

/** Chave `yyyy-mm` (mês 1–12). */
export function agendamentosMensagensMonthKey(year: number, month1to12: number): string {
  return `${year}-${String(month1to12).padStart(2, '0')}`
}

function listRowToDiaItem(row: AgendamentoMensagemListItem): AgendamentoDiaItem {
  return {
    id: row.id,
    data_agendada: row.data_agendada,
    iana_timezone: row.iana_timezone,
    id_canal: row.id_canal,
    usuario_empresa_id: null,
    mensagem_type: row.mensagem_type,
    mensagem_texto: row.mensagem_texto,
    nomecliente: row.nomecliente,
    telefone: row.telefone,
    status: row.status,
    midia_url: row.midia_url,
    recorrente: row.recorrente,
    intervalo_recorrencia: row.intervalo_recorrencia,
  }
}

const carregarInflight = new Map<string, Promise<void>>()
const destinatariosInflight = new Map<string, Promise<void>>()

export function destinatariosCacheKey(workspaceId: number, idCanal: number, q: string): string {
  return `${workspaceId}|${idCanal}|${q.trim().toLowerCase()}`
}

function destinatarioConversaParaUi(c: AgendamentoDestinatarioConversa): ContatoDestinoUi {
  return {
    key: `${c.id_canal ?? 0}:${c.lid ?? ''}:${c.connect_phone ?? ''}:${c.name ?? ''}`,
    nomecliente: c.name,
    telefone: c.connect_phone ?? c.lid,
  }
}

function mensagemErroFetch(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const payload = (err as { data?: unknown }).data
    if (payload && typeof payload === 'object') {
      const p = payload as Record<string, unknown>
      if (typeof p.statusMessage === 'string' && p.statusMessage.trim()) {
        return p.statusMessage
      }
      if (typeof p.message === 'string' && p.message.trim()) {
        return p.message
      }
    }
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}

type DestinatariosCacheBucket = {
  items: ContatoDestinoUi[]
  page: number
  perPage: number
  total: number
  loadedAt: number | null
}

type DestinatariosState = {
  items: ContatoDestinoUi[]
  page: number
  perPage: number
  total: number
  loading: boolean
  loadingMore: boolean
  error: string | null
  busca: string
  workspaceId: number | null
  idCanal: number | null
}

function emptyDestinatariosState(): DestinatariosState {
  return {
    items: [],
    page: 1,
    perPage: 20,
    total: 0,
    loading: false,
    loadingMore: false,
    error: null,
    busca: '',
    workspaceId: null,
    idCanal: null,
  }
}

function emptyDestinatariosBucket(): DestinatariosCacheBucket {
  return {
    items: [],
    page: 1,
    perPage: 20,
    total: 0,
    loadedAt: null,
  }
}

type AgendamentosMensagensState = {
  /** Itens agregados de todas as páginas daquele mês. */
  porMes: Record<string, AgendamentoDiaItem[]>
  loadingMes: Record<string, boolean>
  erroMes: Record<string, string | null>
  /** Agendamento em edição (modal); `null` quando fechado ou modo criar. */
  agendamentoSelecionado: AgendamentoDiaItem | null
  /** Conversas/contatos para o modal de agendamento (aba Destinatários). */
  destinatarios: DestinatariosState
  /** Cache por workspace + canal + termo de busca. */
  destinatariosPorChave: Record<string, DestinatariosCacheBucket>
}

export const useAgendamentosMensagensStore = defineStore('agendamentosMensagens', {
  state: (): AgendamentosMensagensState => ({
    porMes: {},
    loadingMes: {},
    erroMes: {},
    agendamentoSelecionado: null,
    destinatarios: emptyDestinatariosState(),
    destinatariosPorChave: {},
  }),

  getters: {
    destinatariosHasMore(state): boolean {
      const d = state.destinatarios
      return d.page * d.perPage < d.total
    },
    itensDoMes:
      (state) =>
      (year: number, month1to12: number): AgendamentoDiaItem[] => {
        const key = agendamentosMensagensMonthKey(year, month1to12)
        return state.porMes[key] ?? []
      },
    estaCarregandoMes:
      (state) =>
      (year: number, month1to12: number): boolean => {
        const key = agendamentosMensagensMonthKey(year, month1to12)
        return Boolean(state.loadingMes[key])
      },
  },

  actions: {
    temMesCarregado(year: number, month1to12: number): boolean {
      const key = agendamentosMensagensMonthKey(year, month1to12)
      return Object.prototype.hasOwnProperty.call(this.porMes, key)
    },

    invalidarMes(year: number, month1to12: number) {
      const key = agendamentosMensagensMonthKey(year, month1to12)
      delete this.porMes[key]
      delete this.loadingMes[key]
      delete this.erroMes[key]
    },

    /** Cópia superficial — evita o modal mutar o objeto da lista em cache. */
    setAgendamentoSelecionado(item: AgendamentoDiaItem | null) {
      this.agendamentoSelecionado = item ? { ...item } : null
    },

    limparAgendamentoSelecionado() {
      this.agendamentoSelecionado = null
    },

    resetDestinatarios() {
      this.destinatarios = emptyDestinatariosState()
    },

    invalidarDestinatariosCache(workspaceId?: number, idCanal?: number) {
      if (workspaceId == null && idCanal == null) {
        this.destinatariosPorChave = {}
        this.resetDestinatarios()
        return
      }
      for (const key of Object.keys(this.destinatariosPorChave)) {
        const [widRaw, canalRaw] = key.split('|')
        const wid = Number(widRaw)
        const canal = Number(canalRaw)
        if (workspaceId != null && wid !== workspaceId) continue
        if (idCanal != null && canal !== idCanal) continue
        delete this.destinatariosPorChave[key]
      }
    },

    temDestinatariosCarregados(workspaceId: number, idCanal: number, q = ''): boolean {
      const key = destinatariosCacheKey(workspaceId, idCanal, q)
      const bucket = this.destinatariosPorChave[key]
      return bucket?.loadedAt != null
    },

    aplicarDestinatariosDoCache(workspaceId: number, idCanal: number, q = '') {
      const key = destinatariosCacheKey(workspaceId, idCanal, q)
      const bucket = this.destinatariosPorChave[key]
      if (!bucket) return

      this.destinatarios.workspaceId = workspaceId
      this.destinatarios.idCanal = idCanal
      this.destinatarios.busca = q.trim()
      this.destinatarios.items = bucket.items
      this.destinatarios.page = bucket.page
      this.destinatarios.perPage = bucket.perPage
      this.destinatarios.total = bucket.total
      this.destinatarios.error = null
      this.destinatarios.loading = false
      this.destinatarios.loadingMore = false
    },

    /**
     * Usa cache do Pinia quando já carregado; só chama a API se ainda não existir.
     */
    async buscarDestinatariosSeNecessario(opts: {
      workspaceId: number
      idCanal: number
      q?: string
    }): Promise<void> {
      const q = (opts.q ?? '').trim()
      const cacheKey = destinatariosCacheKey(opts.workspaceId, opts.idCanal, q)

      if (this.temDestinatariosCarregados(opts.workspaceId, opts.idCanal, q)) {
        this.aplicarDestinatariosDoCache(opts.workspaceId, opts.idCanal, q)
        return
      }

      const existente = destinatariosInflight.get(cacheKey)
      if (existente) {
        await existente
        if (this.temDestinatariosCarregados(opts.workspaceId, opts.idCanal, q)) {
          this.aplicarDestinatariosDoCache(opts.workspaceId, opts.idCanal, q)
        }
        return
      }

      const exec = this.buscarDestinatarios({
        workspaceId: opts.workspaceId,
        idCanal: opts.idCanal,
        q,
        page: 1,
      }).finally(() => {
        destinatariosInflight.delete(cacheKey)
      })

      destinatariosInflight.set(cacheKey, exec)
      await exec
    },

    async buscarDestinatarios(opts: {
      workspaceId: number
      idCanal: number
      q?: string
      page?: number
      append?: boolean
    }): Promise<void> {
      const page = opts.page ?? 1
      const append = opts.append === true
      const q = (opts.q ?? '').trim()
      const cacheKey = destinatariosCacheKey(opts.workspaceId, opts.idCanal, q)

      if (append) {
        this.destinatarios.loadingMore = true
      } else {
        this.destinatarios.loading = true
        this.destinatarios.error = null
      }

      this.destinatarios.workspaceId = opts.workspaceId
      this.destinatarios.idCanal = opts.idCanal
      this.destinatarios.busca = q

      try {
        const res = await $fetch<AgendamentoDestinatariosListResponse>('/api/agendamento-de-mensagem/conversas', {
          query: {
            workspace_id: opts.workspaceId,
            id_canal: opts.idCanal,
            page,
            ...(q ? { q } : {}),
          },
        })

        const mapped = res.data.map(destinatarioConversaParaUi)
        const bucket = this.destinatariosPorChave[cacheKey] ?? emptyDestinatariosBucket()
        const items = append ? [...bucket.items, ...mapped] : mapped

        const atualizado: DestinatariosCacheBucket = {
          items,
          page: res.page,
          perPage: res.perPage,
          total: res.total,
          loadedAt: Date.now(),
        }
        this.destinatariosPorChave[cacheKey] = atualizado
        this.aplicarDestinatariosDoCache(opts.workspaceId, opts.idCanal, q)
      } catch (e: unknown) {
        if (!append) {
          delete this.destinatariosPorChave[cacheKey]
          this.destinatarios.items = []
          this.destinatarios.total = 0
          this.destinatarios.page = 1
        }
        this.destinatarios.error = mensagemErroFetch(e, 'Falha ao carregar contatos.')
        throw e
      } finally {
        this.destinatarios.loading = false
        this.destinatarios.loadingMore = false
      }
    },

    async carregarMaisDestinatarios(): Promise<void> {
      const d = this.destinatarios
      if (d.loading || d.loadingMore) return
      if (d.workspaceId == null || d.idCanal == null) return
      if (d.page * d.perPage >= d.total) return

      const nextPage = d.page + 1
      const cacheKey = destinatariosCacheKey(d.workspaceId, d.idCanal, d.busca)
      const bucket = this.destinatariosPorChave[cacheKey]
      if (bucket && bucket.page >= nextPage) {
        this.aplicarDestinatariosDoCache(d.workspaceId, d.idCanal, d.busca)
        return
      }

      await this.buscarDestinatarios({
        workspaceId: d.workspaceId,
        idCanal: d.idCanal,
        q: d.busca,
        page: nextPage,
        append: true,
      })
    },

    /**
     * Se o mês já estiver em cache, não chama a API.
     * Caso contrário, busca todas as páginas daquele mês e grava em `porMes`.
     */
    async carregarMesSeNecessario(workspaceId: number, year: number, month1to12: number): Promise<void> {
      const key = agendamentosMensagensMonthKey(year, month1to12)
      if (this.temMesCarregado(year, month1to12)) return

      const existente = carregarInflight.get(key)
      if (existente) {
        await existente
        return
      }

      const exec = (async () => {
        this.loadingMes[key] = true
        this.erroMes[key] = null
        try {
          const acumulado: AgendamentoDiaItem[] = []
          let page = 1
          let total = 0

          while (page <= MAX_PAGES) {
            const res = await $fetch<AgendamentoMensagemListResponse>('/api/agendamento-de-mensagem', {
              query: {
                workspace_id: workspaceId,
                year,
                month: month1to12,
                page,
                page_size: PAGE_SIZE_FETCH,
              },
            })
            total = res.total
            for (const row of res.items) {
              acumulado.push(listRowToDiaItem(row))
            }
            if (acumulado.length >= total || res.items.length === 0) break
            page += 1
          }

          this.porMes[key] = acumulado
        } catch (e: unknown) {
          const msg =
            e && typeof e === 'object' && 'data' in e
              ? String((e as { data?: { statusMessage?: string } }).data?.statusMessage ?? '')
              : ''
          const fallback = e instanceof Error ? e.message : 'Falha ao carregar agendamentos.'
          this.erroMes[key] = msg || fallback
          throw e
        } finally {
          this.loadingMes[key] = false
          carregarInflight.delete(key)
        }
      })()

      carregarInflight.set(key, exec)
      await exec
    },
  },
})
