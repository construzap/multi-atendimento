import { defineStore } from 'pinia'
import type { CampoPersonalizado, ValorCampoPersonalizado } from '#shared/types/camposPersonalizados'
import type { Conversa, ConversaAtualizarResponse, ConversaCampoPersonalizado, ConversaPatch, ConversasListResponse } from '#shared/types/conversa'
import type { PusherNovaMensagemPayload } from '#shared/types/mensagem'
import { useCanaisStore } from '~/stores/canais'
import { useCamposPersonalizadosStore } from '~/stores/camposPersonalizados'
import { useConfiguracoesStore } from '~/stores/configuracoes'
import { useKanbanStore } from '~/stores/kanban'
import { useWorkspacesStore } from '~/stores/workspaces'

export const CODIGO_COLUNA_ORIGEM_LEADS_NAO_CONFIGURADA = 'COLUNA_ORIGEM_LEADS_NAO_CONFIGURADA'

export class ColunaOrigemLeadsNaoConfiguradaError extends Error {
  readonly code = CODIGO_COLUNA_ORIGEM_LEADS_NAO_CONFIGURADA
  constructor() {
    super('Configure a coluna origem dos leads em Configurações antes de criar conversas.')
    this.name = 'ColunaOrigemLeadsNaoConfiguradaError'
  }
}

export function isColunaOrigemLeadsNaoConfiguradaError(err: unknown): boolean {
  if (err instanceof ColunaOrigemLeadsNaoConfiguradaError) return true
  if (!err || typeof err !== 'object') return false
  const e = err as { name?: string; data?: unknown }
  if (e.name === 'ColunaOrigemLeadsNaoConfiguradaError') return true
  const payload = e.data
  if (!payload || typeof payload !== 'object') return false
  const p = payload as Record<string, unknown>
  if (p.code === CODIGO_COLUNA_ORIGEM_LEADS_NAO_CONFIGURADA) return true
  const inner = p.data
  if (inner && typeof inner === 'object') {
    return (inner as Record<string, unknown>).code === CODIGO_COLUNA_ORIGEM_LEADS_NAO_CONFIGURADA
  }
  return false
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

type CanalConversasState = {
  items: Conversa[]
  page: number
  perPage: number
  total: number
  pending: boolean
  error: string | null
  /** Timestamp (ms) do último carregamento bem sucedido. */
  loadedAt: number | null
  /** Conversa/contato selecionado dentro do canal (ex.: phone ou lid). */
  conversaAtual: string | null
}

export type ConversasFiltrosKanban = {
  funilId: number | null
  colunaId: number | null
}

export type ConversasFiltros = {
  /** Inclui conversas com `conversa_aberta = false` na lista. */
  mostrarFechadas: boolean
  /** Inclui conversas de grupo (`is_group = true`) na lista. */
  mostrarGrupos: boolean
  /** Termo de busca server-side em `name`/`phone` (Enter no input). */
  termoPesquisa: string
  kanban: ConversasFiltrosKanban
}

type ConversasState = {
  /** Canal atualmente selecionado (espelha o store de canais). */
  activeCanalId: number | null
  /** Cache por canal. */
  byCanal: Record<number, CanalConversasState>
  /** Filtros da lista lateral de conversas. */
  filtros: ConversasFiltros
}

function emptyFiltros(): ConversasFiltros {
  return {
    mostrarFechadas: false,
    mostrarGrupos: false,
    termoPesquisa: '',
    kanban: {
      funilId: null,
      colunaId: null,
    },
  }
}

function emptyCanalState(): CanalConversasState {
  return {
    items: [],
    page: 1,
    perPage: 20,
    total: 0,
    pending: false,
    error: null,
    loadedAt: null,
    conversaAtual: null
  }
}

/** Mantém a primeira ocorrência de cada `key` (ordem preservada). */
function dedupeConversasByKey(items: Conversa[]): Conversa[] {
  const seen = new Set<string>()
  const out: Conversa[] = []
  for (const item of items) {
    const k = item.key?.trim()
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(item)
  }
  return out
}

/** Evita GET duplicado ao garantir conversa na lista lateral. */
const ensureConversaNaListaInflight = new Map<string, Promise<void>>()

function mergeCamposPersonalizados(
  campos: CampoPersonalizado[],
  valores: ValorCampoPersonalizado[],
): ConversaCampoPersonalizado[] {
  const map = new Map(valores.map((v) => [v.campo_id, v.valor]))
  return campos.map((c) => ({
    id: c.id,
    nome: c.nome,
    tipo: c.tipo,
    valor: map.get(c.id) ?? null,
  }))
}

type FetchOptions = {
  /** Se true, adiciona ao final (paginação / carregar mais). */
  append?: boolean
  /** Filtro opcional repassado à API (`conversa_aberta`). */
  conversaAberta?: boolean
  /** Quando false, API retorna só conversas 1:1 (`is_group` null/false). */
  isGroup?: boolean
  /** Termo de busca server-side (name/phone). */
  q?: string
  /** Filtro opcional de coluna do kanban. */
  colunaId?: number
}

export const useConversasStore = defineStore('conversas', {
  state: (): ConversasState => ({
    activeCanalId: null,
    byCanal: {},
    filtros: emptyFiltros(),
  }),
  getters: {
    active(state): CanalConversasState | null {
      if (state.activeCanalId == null) return null
      return state.byCanal[state.activeCanalId] ?? null
    },
    items(state): Conversa[] {
      const a = state.activeCanalId == null ? null : state.byCanal[state.activeCanalId]
      return a?.items ?? []
    },
    pending(state): boolean {
      const a = state.activeCanalId == null ? null : state.byCanal[state.activeCanalId]
      return a?.pending ?? false
    },
    error(state): string | null {
      const a = state.activeCanalId == null ? null : state.byCanal[state.activeCanalId]
      return a?.error ?? null
    },
    total(state): number {
      const a = state.activeCanalId == null ? null : state.byCanal[state.activeCanalId]
      return a?.total ?? 0
    },
    page(state): number {
      const a = state.activeCanalId == null ? null : state.byCanal[state.activeCanalId]
      return a?.page ?? 1
    },
    perPage(state): number {
      const a = state.activeCanalId == null ? null : state.byCanal[state.activeCanalId]
      return a?.perPage ?? 20
    },
    /** Ainda há registros além da página atual (para “carregar mais” depois). */
    hasMore(state): boolean {
      const a = state.activeCanalId == null ? null : state.byCanal[state.activeCanalId]
      if (!a) return false
      return a.page * a.perPage < a.total
    },
    /** Já existe cache para o canal atual? */
    hasCacheForActive(state): boolean {
      if (state.activeCanalId == null) return false
      const a = state.byCanal[state.activeCanalId]
      return Boolean(a && a.loadedAt != null)
    }
    ,
    /** Conversa/contato atualmente selecionado no canal ativo. */
    conversaAtual(state): string | null {
      if (state.activeCanalId == null) return null
      return state.byCanal[state.activeCanalId]?.conversaAtual ?? null
    },

    /** Busca conversa em qualquer canal já carregado no cache. */
    findConversaByKey(state): (conversaKey: string) => Conversa | null {
      return (conversaKey: string) => {
        const k = conversaKey.trim()
        if (!k) return null
        for (const bucket of Object.values(state.byCanal)) {
          const found = bucket.items.find((c) => c.key === k)
          if (found) return found
        }
        return null
      }
    },

    /** Filtros da lista lateral — espelham `state.filtros`. */
    mostrarFechadas(state): boolean {
      return state.filtros.mostrarFechadas
    },
    mostrarGrupos(state): boolean {
      return state.filtros.mostrarGrupos
    },
    filtroKanbanFunilId(state): number | null {
      return state.filtros.kanban.funilId
    },
    filtroKanbanColunaId(state): number | null {
      return state.filtros.kanban.colunaId
    },
    temFiltroKanbanAtivo(state): boolean {
      return state.filtros.kanban.funilId != null || state.filtros.kanban.colunaId != null
    },
    termoPesquisa(state): string {
      return state.filtros.termoPesquisa
    },
  },
  actions: {
    /** Opções de fetch da lista lateral (abertas/fechadas, 1:1/grupos, kanban). */
    listFetchOptions(append = false): FetchOptions {
      const opts: FetchOptions = { append }
      if (!this.filtros.mostrarFechadas) opts.conversaAberta = true
      if (!this.filtros.mostrarGrupos) opts.isGroup = false
      if (this.filtros.kanban.colunaId != null) opts.colunaId = this.filtros.kanban.colunaId
      return opts
    },

    /** Busca pelo input: somente `q` em name/phone — sem filtros Pinia. */
    searchFetchOptions(append = false): FetchOptions {
      const opts: FetchOptions = { append }
      const q = this.filtros.termoPesquisa?.trim()
      if (q) opts.q = q
      return opts
    },

    /** Lista normal ou busca, conforme termo aplicado no input. */
    resolveFetchOptions(append = false): FetchOptions {
      if (this.filtros.termoPesquisa?.trim()) return this.searchFetchOptions(append)
      return this.listFetchOptions(append)
    },

    async setMostrarConversasFechadas(value: boolean) {
      await this.setMostrarFechadas(value)
    },

    async setMostrarFechadas(value: boolean) {
      if (this.filtros.mostrarFechadas === value) return
      this.filtros.mostrarFechadas = value
      this.filtros.termoPesquisa = ''

      const idCanal = this.activeCanalId
      if (idCanal == null) return

      await this.fetchPage(1, idCanal, this.listFetchOptions())
    },

    async setMostrarGrupos(value: boolean) {
      if (this.filtros.mostrarGrupos === value) return
      this.filtros.mostrarGrupos = value
      this.filtros.termoPesquisa = ''

      const idCanal = this.activeCanalId
      if (idCanal == null) return

      await this.fetchPage(1, idCanal, this.listFetchOptions())
    },

    createTempKey(seed?: string): string {
      const base = seed?.trim() ? seed.trim() : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      return `temp:${base}`
    },

    addOrUpdateLocalConversa(conversa: Conversa, canalId?: number) {
      const idCanal = canalId ?? this.activeCanalId
      if (idCanal == null) return
      this.setActiveCanalId(idCanal)
      const bucket = this.byCanal[idCanal] ?? (this.byCanal[idCanal] = emptyCanalState())
      if (bucket.loadedAt == null) bucket.loadedAt = Date.now()

      const key = conversa.key?.trim()
      if (!key) return

      const prev = bucket.items.find((c) => c.key === key)
      const without = bucket.items.filter((c) => c.key !== key)
      const wasNew = !prev

      const merged: Conversa = prev
        ? {
            ...prev,
            ...conversa,
            key,
            campos_personalizados:
              conversa.campos_personalizados ?? prev.campos_personalizados,
          }
        : conversa

      bucket.items = dedupeConversasByKey([merged, ...without])
      if (wasNew) bucket.total = Math.max(0, (bucket.total ?? 0) + 1)
    },

    /**
     * Garante que a conversa exista em `byCanal[canalId].items` (ex.: aberta via URL/kanban).
     * Se não estiver no cache, busca GET `/api/conversas?key=`.
     * Com `force: true`, sempre re-busca e mescla (inclui `name` do banco).
     */
    async ensureConversaNaLista(
      canalId: number,
      conversaKey: string,
      options: { force?: boolean } = {},
    ) {
      const idCanal = Math.trunc(canalId)
      const key = conversaKey.trim()
      if (!Number.isFinite(idCanal) || idCanal < 1 || !key || key.startsWith('temp:')) return

      this.setActiveCanalId(idCanal)
      const bucket = this.byCanal[idCanal] ?? (this.byCanal[idCanal] = emptyCanalState())
      if (!options.force && bucket.items.some((c) => c.key === key)) return

      const inflightKey = `${idCanal}:${key}:${options.force ? 'force' : 'soft'}`
      const inflight = ensureConversaNaListaInflight.get(inflightKey)
      if (inflight) return inflight

      const promise = (async () => {
        const res = await $fetch<ConversasListResponse>('/api/conversas', {
          method: 'GET',
          query: { id_canal: idCanal, key },
        })
        const conversa = res.data[0]
        if (conversa) {
          this.addOrUpdateLocalConversa(conversa, idCanal)
        }
      })()
        .catch(() => {
          /* falha silenciosa; lista pode não exibir preview até próximo fetch */
        })
        .finally(() => {
          ensureConversaNaListaInflight.delete(inflightKey)
        })

      ensureConversaNaListaInflight.set(inflightKey, promise)
      return promise
    },

    removeLocalConversaByKey(conversaKey: string, canalId?: number) {
      const idCanal = canalId ?? this.activeCanalId
      if (idCanal == null) return
      const bucket = this.byCanal[idCanal] ?? (this.byCanal[idCanal] = emptyCanalState())
      const before = bucket.items.length
      bucket.items = bucket.items.filter((c) => c.key !== conversaKey)
      const removed = before - bucket.items.length
      if (removed > 0) bucket.total = Math.max(0, (bucket.total ?? 0) - removed)
      if (bucket.conversaAtual === conversaKey) bucket.conversaAtual = null
    },

    /**
     * Garante que exista uma conversa no banco para (canal + phone).
     * Exige `coluna_origem_leads` nas configurações do workspace (Pinia / GET ia).
     * - Cria uma conversa temporária (key `temp:`) imediatamente no Pinia e seleciona.
     * - Depois resolve no backend (busca ou cria) e substitui no Pinia.
     */
    async ensureConversaByPhone(input: { id_canal: number; phone: string }) {
      const idCanal = input.id_canal
      const phone = input.phone.trim()
      if (!idCanal || !phone) return

      const workspaces = useWorkspacesStore()
      const workspaceIdRaw = workspaces.currentWorkspaceId
      const workspaceId =
        workspaceIdRaw != null && workspaceIdRaw !== ''
          ? Number.parseInt(String(workspaceIdRaw).trim(), 10)
          : NaN
      if (!Number.isFinite(workspaceId) || workspaceId < 1) {
        throw new Error('Workspace não identificado.')
      }

      const configuracoes = useConfiguracoesStore()
      const colunaOrigemId = await configuracoes.obterColunaOrigemLeadsId(workspaceId)
      if (colunaOrigemId == null) {
        throw new ColunaOrigemLeadsNaoConfiguradaError()
      }

      const tempKey = this.createTempKey(phone)
      const temp: Conversa = {
        key: tempKey,
        message: null,
        messatype: null,
        name: null,
        created_at: null,
        updated_at: null,
        id_canal: idCanal,
        phone,
        lid: null,
        connect_phone: null,
        photo: null,
        from_me: null,
        media_url: null,
        conversa_aberta: true,
        is_group: null,
        id_group: null,
        name_group: null,
        nao_lidas: 0,
        funil_id: null,
        coluna_id: null,
        atendente_id: null,
      }

      this.addOrUpdateLocalConversa(temp, idCanal)
      this.setConversaAtual(tempKey, idCanal)

      try {
        const real = await $fetch<Conversa>('/api/conversas/ensure', {
          method: 'POST',
          body: { id_canal: idCanal, telefone: phone },
        })

        this.removeLocalConversaByKey(tempKey, idCanal)
        this.addOrUpdateLocalConversa(real, idCanal)
        this.setConversaAtual(real.key, idCanal)
      } catch (err) {
        this.removeLocalConversaByKey(tempKey, idCanal)
        this.setConversaAtual(null, idCanal)
        if (isColunaOrigemLeadsNaoConfiguradaError(err)) {
          throw new ColunaOrigemLeadsNaoConfiguradaError()
        }
        throw err
      }
    },

    /** Troca o canal ativo (não apaga cache). */
    setActiveCanalId(id: number | null) {
      if (id !== this.activeCanalId) {
        this.filtros.termoPesquisa = ''
        this.filtros.kanban.funilId = null
        this.filtros.kanban.colunaId = null
      }
      this.activeCanalId = id
      if (id == null) return
      if (!this.byCanal[id]) this.byCanal[id] = emptyCanalState()
    },

    async aplicarPesquisa(termo: string) {
      this.filtros.termoPesquisa = termo.trim()
      const idCanal = this.activeCanalId
      if (idCanal == null) return
      const opts = this.filtros.termoPesquisa
        ? this.searchFetchOptions()
        : this.listFetchOptions()
      await this.fetchPage(1, idCanal, opts)
    },

    async limparPesquisa() {
      if (!this.filtros.termoPesquisa.trim()) return
      this.filtros.termoPesquisa = ''
      const idCanal = this.activeCanalId
      if (idCanal == null) return
      await this.fetchPage(1, idCanal, this.listFetchOptions())
    },

    setFiltroKanbanFunil(funilId: number | null) {
      const id =
        funilId != null && Number.isFinite(funilId) && funilId > 0
          ? Math.trunc(funilId)
          : null
      this.filtros.kanban.funilId = id
      if (id == null) this.filtros.kanban.colunaId = null
    },

    _funilIdDaColunaKanban(colunaId: number): number | null {
      const kanban = useKanbanStore()
      for (const funil of kanban.funis) {
        if (funil.columns.some((c) => c.id === colunaId)) return funil.id
      }
      return null
    },

    async aplicarFiltroColuna(colunaId: number) {
      const id = Number.parseInt(String(colunaId), 10)
      if (!Number.isFinite(id) || id < 1) return

      this.filtros.termoPesquisa = ''
      this.filtros.kanban.colunaId = id
      this.filtros.kanban.funilId = this._funilIdDaColunaKanban(id)
      const idCanal = this.activeCanalId
      if (idCanal == null) return
      await this.fetchPage(1, idCanal, this.listFetchOptions())
    },

    /**
     * Ao abrir conversa a partir do kanban: alinha filtros da lista (coluna/funil)
     * e liga “fechadas”/“grupos” se a conversa exigir para aparecer na lista.
     */
    async aplicarContextoAoAbrirDoKanban(input: {
      conversaKey?: string | null
      colunaId?: number | null
      funilId?: number | null
      isGroup?: boolean | null
      conversaAberta?: boolean | null
    }) {
      this.filtros.termoPesquisa = ''

      const colunaRaw = input.colunaId
      const colunaId =
        colunaRaw != null && Number.isFinite(colunaRaw) && colunaRaw > 0
          ? Math.trunc(colunaRaw)
          : null

      if (colunaId != null) {
        this.filtros.kanban.colunaId = colunaId
        const funilRaw = input.funilId
        const funilId =
          funilRaw != null && Number.isFinite(funilRaw) && funilRaw > 0
            ? Math.trunc(funilRaw)
            : this._funilIdDaColunaKanban(colunaId)
        this.filtros.kanban.funilId = funilId
      }

      if (input.conversaAberta === false) {
        this.filtros.mostrarFechadas = true
      }
      if (input.isGroup === true) {
        this.filtros.mostrarGrupos = true
      }

      const idCanal = this.activeCanalId
      if (idCanal == null) return
      await this.fetchPage(1, idCanal, this.listFetchOptions())

      const key = input.conversaKey?.trim()
      if (key) {
        await this.ensureConversaNaLista(idCanal, key)
        this.setConversaAtual(key, idCanal)
      }
    },

    async limparFiltroKanban() {
      const tinhaFiltro =
        this.filtros.kanban.colunaId != null || this.filtros.kanban.funilId != null
      this.filtros.termoPesquisa = ''
      this.filtros.kanban.funilId = null
      this.filtros.kanban.colunaId = null
      const idCanal = this.activeCanalId
      if (idCanal == null || !tinhaFiltro) return
      await this.fetchPage(1, idCanal, this.listFetchOptions())
    },

    async atualizarLista() {
      const idCanal = this.activeCanalId
      if (idCanal == null) return
      await this.fetchPage(1, idCanal, this.resolveFetchOptions())
    },

    /** Limpa apenas o canal ativo (mantém cache de outros canais). */
    resetActive() {
      const id = this.activeCanalId
      if (id == null) return
      this.byCanal[id] = emptyCanalState()
    },

    /** Limpa TODO o cache. */
    resetAll() {
      this.byCanal = {}
      this.activeCanalId = null
    },

    /**
     * Busca conversas para um canal/página.
     * Se `canalId` não for informado, usa o canal atual do `useCanaisStore()`.
     */
    async fetchPage(page: number = 1, canalId?: number, options: FetchOptions = {}) {
      const canais = useCanaisStore()
      const idCanal = canalId ?? canais.currentCanalId
      if (idCanal == null) {
        this.setActiveCanalId(null)
        return
      }

      this.setActiveCanalId(idCanal)
      const bucket = this.byCanal[idCanal] ?? (this.byCanal[idCanal] = emptyCanalState())

      bucket.pending = true
      bucket.error = null
      try {
        const query: Record<string, string | number | boolean> = {
          id_canal: idCanal,
          page
        }
        if (options.conversaAberta === true) query.conversa_aberta = true
        else if (options.conversaAberta === false) query.conversa_aberta = false
        if (options.isGroup === false) query.is_group = false
        if (options.colunaId != null) query.coluna_id = options.colunaId
        if (options.q) query.q = options.q

        const res = await $fetch<ConversasListResponse>('/api/conversas', {
          method: 'GET',
          query
        })
        if (options.append) {
          // Dedup por `key` para evitar repetições em caso de re-fetch.
          const seen = new Set(bucket.items.map((i) => i.key))
          const next = [...bucket.items]
          for (const it of res.data) {
            if (seen.has(it.key)) continue
            seen.add(it.key)
            next.push(it)
          }
          bucket.items = next
        } else {
          bucket.items = res.data
        }
        bucket.page = res.page
        bucket.perPage = res.perPage
        bucket.total = res.total
        bucket.loadedAt = Date.now()
      } catch (err) {
        bucket.items = []
        bucket.total = 0
        bucket.error = mensagemErroFetch(err, 'Não foi possível carregar as conversas.')
        throw err
      } finally {
        bucket.pending = false
      }
    },

    /**
     * Cache-first: só busca se ainda não houver cache carregado para o canal.
     * Útil para o watcher (troca de canal).
     */
    async ensureLoaded(canalId: number, page: number = 1) {
      this.setActiveCanalId(canalId)
      const bucket = this.byCanal[canalId] ?? (this.byCanal[canalId] = emptyCanalState())
      if (bucket.loadedAt != null) return
      await this.fetchPage(page, canalId, this.resolveFetchOptions())
    },

    /**
     * Carrega a próxima página do canal ativo (append).
     * Não faz nada se não houver `hasMore` ou se já estiver pendente.
     */
    async fetchNextPage(canalId?: number) {
      const canais = useCanaisStore()
      const idCanal = canalId ?? this.activeCanalId ?? canais.currentCanalId
      if (idCanal == null) return

      this.setActiveCanalId(idCanal)
      const bucket = this.byCanal[idCanal] ?? (this.byCanal[idCanal] = emptyCanalState())
      if (bucket.pending) return
      if (!(bucket.page * bucket.perPage < bucket.total)) return

      const nextPage = bucket.page + 1
      await this.fetchPage(nextPage, idCanal, this.resolveFetchOptions(true))
    },

    /** Atualiza dados da conversa no banco e espelha no cache do canal. */
    async atualizarConversa(workspaceId: number, key: string, patch: ConversaPatch): Promise<Conversa> {
      const conversaKey = key?.trim()
      if (!workspaceId || !conversaKey) {
        throw new Error('workspace_id e key são obrigatórios.')
      }

      const res = await $fetch<ConversaAtualizarResponse>('/api/conversas/atualizar', {
        method: 'PATCH',
        body: {
          workspace_id: workspaceId,
          key: conversaKey,
          patch,
        },
      })

      const atualizada = res.data
      const canalId = atualizada.id_canal ?? this.activeCanalId
      if (canalId != null) {
        this.addOrUpdateLocalConversa(atualizada, canalId)
      }

      useKanbanStore().espelharConversaAtualizadaNoBoard(workspaceId, atualizada)

      return atualizada
    },

    _aplicarCamposPersonalizadosNaConversa(
      conversaKey: string,
      campos: ConversaCampoPersonalizado[],
    ) {
      const key = conversaKey.trim()
      if (!key) return

      for (const bucket of Object.values(this.byCanal)) {
        const idx = bucket.items.findIndex((c) => c.key === key)
        if (idx === -1) continue
        bucket.items[idx] = { ...bucket.items[idx]!, campos_personalizados: campos }
      }
    },

    /**
     * Carrega definições (workspace) e valores (conversa) dos campos personalizados.
     * Cache-first via `camposPersonalizados` store; grava em `items[].campos_personalizados`.
     */
    async ensureCamposPersonalizadosNaConversa(workspaceId: number, conversaKey: string) {
      const key = conversaKey.trim()
      if (!workspaceId || !key || key.startsWith('temp:')) return []

      const existente = this.findConversaByKey(key)
      if (existente?.campos_personalizados !== undefined) {
        return existente.campos_personalizados
      }

      const camposStore = useCamposPersonalizadosStore()

      let campos: CampoPersonalizado[] = []
      let valores: ValorCampoPersonalizado[] = []

      try {
        campos = await camposStore.fetchCampos(workspaceId)
      } catch {
        campos = camposStore.camposPorWorkspace[workspaceId] ?? []
      }

      try {
        valores = await camposStore.fetchValores(workspaceId, key)
      } catch {
        valores = camposStore.getValores(workspaceId, key)
      }

      const merged = mergeCamposPersonalizados(campos, valores)
      this._aplicarCamposPersonalizadosNaConversa(key, merged)
      return merged
    },

    adicionarCampoPersonalizadoNasConversas(campo: CampoPersonalizado) {
      const novo: ConversaCampoPersonalizado = {
        id: campo.id,
        nome: campo.nome,
        tipo: campo.tipo,
        valor: null,
      }

      for (const bucket of Object.values(this.byCanal)) {
        bucket.items = bucket.items.map((item) => {
          if (item.campos_personalizados === undefined) return item
          if (item.campos_personalizados.some((c) => c.id === campo.id)) return item
          const next = [...item.campos_personalizados, novo]
          next.sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }))
          return { ...item, campos_personalizados: next }
        })
      }
    },

    atualizarCampoPersonalizadoNasConversas(campo: CampoPersonalizado) {
      for (const bucket of Object.values(this.byCanal)) {
        bucket.items = bucket.items.map((item) => {
          if (!item.campos_personalizados?.length) return item
          const idx = item.campos_personalizados.findIndex((c) => c.id === campo.id)
          if (idx === -1) return item
          const next = [...item.campos_personalizados]
          next[idx] = {
            ...next[idx]!,
            nome: campo.nome,
            tipo: campo.tipo,
          }
          return { ...item, campos_personalizados: next }
        })
      }
    },

    atualizarValorCampoPersonalizadoNasConversas(
      conversaKey: string,
      campoId: number,
      valor: string | null,
    ) {
      const key = conversaKey.trim()
      if (!key) return

      for (const bucket of Object.values(this.byCanal)) {
        bucket.items = bucket.items.map((item) => {
          if (item.key !== key || !item.campos_personalizados?.length) return item
          const idx = item.campos_personalizados.findIndex((c) => c.id === campoId)
          if (idx === -1) return item
          const next = [...item.campos_personalizados]
          next[idx] = { ...next[idx]!, valor }
          return { ...item, campos_personalizados: next }
        })
      }
    },

    removerCampoPersonalizadoDasConversas(campoId: number) {
      for (const bucket of Object.values(this.byCanal)) {
        bucket.items = bucket.items.map((item) => {
          if (!item.campos_personalizados?.length) return item
          return {
            ...item,
            campos_personalizados: item.campos_personalizados.filter((c) => c.id !== campoId),
          }
        })
      }
    },

    /**
     * Marca a conversa como fechada no banco e remove da lista local (só abertas).
     */
    async fecharConversa(conversaKey?: string) {
      const key = (conversaKey ?? this.conversaAtual)?.trim()
      if (!key) return

      await $fetch('/api/conversas/fechar', {
        method: 'POST',
        body: { key }
      })

      if (this.filtros.mostrarFechadas) {
        const idCanal = this.activeCanalId
        if (idCanal != null) {
          const bucket = this.byCanal[idCanal]
          if (bucket) {
            const idx = bucket.items.findIndex((c) => c.key === key)
            if (idx !== -1) {
              bucket.items[idx] = { ...bucket.items[idx]!, conversa_aberta: false }
            }
          }
        }
      } else {
        this.removeLocalConversaByKey(key)
      }
      this.setConversaAtual(null)
    },

    /**
     * Zera `nao_lidas` no banco e no cache local ao abrir a conversa.
     * Só chama a API se o Pinia tiver `nao_lidas > 0` para essa conversa.
     */
    async marcarComoLida(conversaKey?: string) {
      const key = (conversaKey ?? this.conversaAtual)?.trim()
      if (!key || key.startsWith('temp:')) return

      const idCanal = this.activeCanalId
      if (idCanal == null) return

      const bucket = this.byCanal[idCanal]
      const item = bucket?.items.find((c) => c.key === key)
      const naoLidasAtual = item?.nao_lidas ?? 0
      if (naoLidasAtual <= 0) return

      if (bucket) {
        const idx = bucket.items.findIndex((c) => c.key === key)
        if (idx !== -1) {
          bucket.items[idx] = { ...bucket.items[idx]!, nao_lidas: 0 }
        }
      }

      await $fetch('/api/conversas/marcar-lidas', {
        method: 'POST',
        body: { key },
      })
    },

    /**
     * Define a conversa selecionada dentro do canal (`conversas.key`).
     */
    setConversaAtual(key: string | null, canalId?: number) {
      const idCanal = canalId ?? this.activeCanalId
      if (idCanal == null) return
      const bucket = this.byCanal[idCanal] ?? (this.byCanal[idCanal] = emptyCanalState())
      bucket.conversaAtual = key && key.trim() ? key.trim() : null
    },

    /** Zera a seleção em todos os canais (ex.: ao sair do chat). */
    clearAllConversaAtual() {
      for (const bucket of Object.values(this.byCanal)) {
        bucket.conversaAtual = null
      }
    },

    /**
     * Evento Pusher `nova-mensagem`: atualiza preview na lista ou cria a conversa.
     * NUNCA altera `name` de conversa já em cache (nome é editável; vem só do PATCH / API).
     * Stub novo: usa só `payload.conversa_name` (banco) e força sync via GET.
     */
    mergeFromPusherNovaMensagem(canalId: number, payload: PusherNovaMensagemPayload) {
      let conversaKey = payload.conversa_key?.trim()
      if (!conversaKey) return
      if (!this.filtros.mostrarGrupos && payload.is_group) return

      const bucket = this.byCanal[canalId] ?? (this.byCanal[canalId] = emptyCanalState())
      const msg = payload.mensagem

      if (bucket.loadedAt == null) bucket.loadedAt = Date.now()

      let idx = bucket.items.findIndex((c) => c.key === conversaKey)

      if (idx === -1 && !payload.is_group) {
        const phone = msg.phone?.trim()
        const lid = msg.lid?.trim()
        if (phone || lid) {
          idx = bucket.items.findIndex((c) => {
            if (lid && c.lid?.trim() === lid) return true
            if (phone && c.phone?.trim() === phone) return true
            return false
          })
          if (idx !== -1) conversaKey = bucket.items[idx]!.key
        }
      }

      const preview = (msg.message ?? msg.caption ?? '').trim() || ' '
      const createdAt = msg.created_at ?? null
      const conversaNameFromDb = payload.conversa_name?.trim() || null

      if (idx === -1) {
        const row: Conversa = {
          key: conversaKey,
          message: preview,
          messatype: msg.messagetype ?? null,
          name: conversaNameFromDb,
          created_at: createdAt,
          updated_at: createdAt,
          id_canal: canalId,
          phone: msg.phone ?? null,
          lid: msg.lid ?? null,
          connect_phone: msg.connected_phone ?? null,
          photo: payload.is_group ? (payload.conversa_photo ?? null) : (msg.photo ?? null),
          from_me: msg.from_me ?? null,
          media_url: msg.media_url ?? null,
          conversa_aberta: msg.from_me === false ? true : null,
          is_group: payload.is_group ? true : null,
          id_group: payload.is_group ? (payload.id_group ?? null) : null,
          name_group: payload.is_group ? (payload.name_group ?? null) : null,
          nao_lidas: msg.from_me === false ? 1 : 0,
          funil_id: null,
          coluna_id: null,
          atendente_id: null,
        }

        if (payload.is_group) {
          row.phone = payload.id_group ?? null
          row.lid = payload.id_group ?? null
          if (!row.name) row.name = payload.name_group ?? null
        }

        bucket.items = dedupeConversasByKey([row, ...bucket.items])
        bucket.total = Math.max(0, (bucket.total ?? 0) + 1)
        // Força GET para trazer name/funil/coluna reais do banco (não confiar só no stub).
        void this.ensureConversaNaLista(canalId, conversaKey, { force: true })
        return
      }

      const current = bucket.items[idx]!
      // Preserva current.name / name_group — Pusher não mexe em nome editável.
      const merged: Conversa = {
        ...current,
        message: preview,
        messatype: msg.messagetype ?? current.messatype,
        from_me: msg.from_me ?? current.from_me,
        media_url: msg.media_url ?? current.media_url,
        updated_at: createdAt ?? current.updated_at,
        name: current.name,
        name_group: current.name_group,
        ...(msg.from_me === false
          ? {
              conversa_aberta: true,
              nao_lidas: (current.nao_lidas ?? 0) + 1,
            }
          : {}),
      }

      if (payload.is_group) {
        merged.is_group = true
        merged.phone = payload.id_group ?? current.phone
        merged.lid = payload.id_group ?? current.lid
        merged.photo = payload.conversa_photo ?? current.photo
        merged.id_group = payload.id_group ?? current.id_group
      } else {
        merged.photo = msg.photo ?? current.photo
      }

      const without = bucket.items.filter((_, i) => i !== idx).filter((c) => c.key !== conversaKey)
      bucket.items = dedupeConversasByKey([merged, ...without])
    },

    removeConversaByDbKey(conversaKey: string) {
      const k = conversaKey.trim()
      if (!k) return
      for (const canalIdStr of Object.keys(this.byCanal)) {
        const idCanal = Number.parseInt(canalIdStr, 10)
        if (!Number.isFinite(idCanal)) continue
        const bucket = this.byCanal[idCanal]
        if (!bucket) continue
        const before = bucket.items.length
        bucket.items = bucket.items.filter((c) => c.key !== k)
        const removed = before - bucket.items.length
        if (removed > 0) bucket.total = Math.max(0, bucket.total - removed)
      }
    }
  }
})
