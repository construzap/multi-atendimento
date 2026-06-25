import { defineStore } from 'pinia'
import type { Conversa, ConversasListResponse } from '#shared/types/conversa'
import type { PusherNovaMensagemPayload } from '#shared/types/mensagem'
import { useCanaisStore } from '~/stores/canais'

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

type ConversasState = {
  /** Canal atualmente selecionado (espelha o store de canais). */
  activeCanalId: number | null
  /** Cache por canal. */
  byCanal: Record<number, CanalConversasState>
  /** Quando true, a lista inclui conversas com `conversa_aberta = false`. */
  mostrarConversasFechadas: boolean
  /** Quando true, a lista inclui conversas de grupo (`is_group = true`). */
  mostrarGrupos: boolean
  /** Termo de busca aplicado na lista lateral (Enter no input). */
  termoPesquisa: string
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

type FetchOptions = {
  /** Se true, adiciona ao final (paginação / carregar mais). */
  append?: boolean
  /** Filtro opcional repassado à API (`conversa_aberta`). */
  conversaAberta?: boolean
  /** Quando false, API retorna só conversas 1:1 (`is_group` null/false). */
  isGroup?: boolean
}

export const useConversasStore = defineStore('conversas', {
  state: (): ConversasState => ({
    activeCanalId: null,
    byCanal: {},
    mostrarConversasFechadas: false,
    mostrarGrupos: false,
    termoPesquisa: ''
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
  },
  actions: {
    /** Opções de fetch da lista lateral (abertas/fechadas e 1:1/grupos). */
    listFetchOptions(append = false): FetchOptions {
      const opts: FetchOptions = { append }
      if (!this.mostrarConversasFechadas) opts.conversaAberta = true
      if (!this.mostrarGrupos) opts.isGroup = false
      return opts
    },

    async setMostrarConversasFechadas(value: boolean) {
      if (this.mostrarConversasFechadas === value) return
      this.mostrarConversasFechadas = value

      const idCanal = this.activeCanalId
      if (idCanal == null) return

      await this.fetchPage(1, idCanal, this.listFetchOptions())
    },

    async setMostrarGrupos(value: boolean) {
      if (this.mostrarGrupos === value) return
      this.mostrarGrupos = value

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

      const idx = bucket.items.findIndex((c) => c.key === conversa.key)
      if (idx === -1) {
        bucket.items = [conversa, ...bucket.items]
        bucket.total = Math.max(0, (bucket.total ?? 0) + 1)
        return
      }

      const merged = { ...bucket.items[idx]!, ...conversa }
      bucket.items = [merged, ...bucket.items.filter((_, i) => i !== idx)]
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
     * - Cria uma conversa temporária (key `temp:`) imediatamente no Pinia e seleciona.
     * - Depois resolve no backend (busca ou cria) e substitui no Pinia.
     */
    async ensureConversaByPhone(input: { id_canal: number; phone: string }) {
      const idCanal = input.id_canal
      const phone = input.phone.trim()
      if (!idCanal || !phone) return

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
      }

      this.addOrUpdateLocalConversa(temp, idCanal)
      this.setConversaAtual(tempKey, idCanal)

      const real = await $fetch<Conversa>('/api/conversas/ensure', {
        method: 'POST',
        body: { id_canal: idCanal, telefone: phone },
      })

      // troca temp pelo real
      this.removeLocalConversaByKey(tempKey, idCanal)
      this.addOrUpdateLocalConversa(real, idCanal)
      this.setConversaAtual(real.key, idCanal)
    },

    /** Troca o canal ativo (não apaga cache). */
    setActiveCanalId(id: number | null) {
      if (id !== this.activeCanalId) {
        this.termoPesquisa = ''
      }
      this.activeCanalId = id
      if (id == null) return
      if (!this.byCanal[id]) this.byCanal[id] = emptyCanalState()
    },

    aplicarPesquisa(termo: string) {
      this.termoPesquisa = termo.trim()
    },

    limparPesquisa() {
      this.termoPesquisa = ''
    },

    async atualizarLista() {
      const idCanal = this.activeCanalId
      if (idCanal == null) return
      await this.fetchPage(1, idCanal, this.listFetchOptions())
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
      await this.fetchPage(page, canalId, this.listFetchOptions())
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
      await this.fetchPage(nextPage, idCanal, this.listFetchOptions(true))
    }

    ,
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

      if (this.mostrarConversasFechadas) {
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

    /**
     * Evento Pusher `nova-mensagem`: atualiza preview na lista ou cria a conversa.
     * `name` / `photo` vêm do payload quando existirem (inclui `from_me === true`, teste — pode voltar a preservar só foto depois).
     */
    mergeFromPusherNovaMensagem(canalId: number, payload: PusherNovaMensagemPayload) {
      const conversaKey = payload.conversa_key?.trim()
      if (!conversaKey) return
      if (!this.mostrarGrupos && payload.is_group) return

      const bucket = this.byCanal[canalId] ?? (this.byCanal[canalId] = emptyCanalState())
      const msg = payload.mensagem

      if (bucket.loadedAt == null) bucket.loadedAt = Date.now()

      const idx = bucket.items.findIndex((c) => c.key === conversaKey)
      const preview = (msg.message ?? msg.caption ?? '').trim() || ' '
      const createdAt = msg.created_at ?? null

      if (idx === -1) {
        const row: Conversa = {
          key: conversaKey,
          message: preview,
          messatype: msg.messagetype ?? null,
          name: msg.name ?? null,
          created_at: createdAt,
          updated_at: createdAt,
          id_canal: canalId,
          phone: msg.phone ?? null,
          lid: msg.lid ?? null,
          connect_phone: msg.connected_phone ?? null,
          photo: msg.photo ?? null,
          from_me: msg.from_me ?? null,
          media_url: msg.media_url ?? null,
          conversa_aberta: msg.from_me === false ? true : null,
          is_group: null,
          id_group: null,
          name_group: null,
          nao_lidas: msg.from_me === false ? 1 : 0,
        }

        if (payload.is_group) {
          row.is_group = true
          row.name = payload.name_group ?? null
          row.phone = payload.id_group ?? null
          row.lid = payload.id_group ?? null
          row.photo = payload.conversa_photo ?? null
          row.id_group = payload.id_group ?? null
          row.name_group = payload.name_group ?? null
        }

        bucket.items = [row, ...bucket.items]
        bucket.total = Math.max(0, (bucket.total ?? 0) + 1)
        return
      }

      const current = bucket.items[idx]!
      const merged: Conversa = {
        ...current,
        message: preview,
        messatype: msg.messagetype ?? current.messatype,
        from_me: msg.from_me ?? current.from_me,
        media_url: msg.media_url ?? current.media_url,
        updated_at: createdAt ?? current.updated_at,
        ...(msg.from_me === false
          ? {
              conversa_aberta: true,
              nao_lidas: (current.nao_lidas ?? 0) + 1,
            }
          : {}),
      }

      if (payload.is_group) {
        merged.is_group = true
        merged.name = payload.name_group ?? current.name
        merged.phone = payload.id_group ?? current.phone
        merged.lid = payload.id_group ?? current.lid
        merged.photo = payload.conversa_photo ?? current.photo
        merged.id_group = payload.id_group ?? current.id_group
        merged.name_group = payload.name_group ?? current.name_group
      } else {
        merged.name = msg.name ?? current.name
        merged.photo = msg.photo ?? current.photo
      }

      bucket.items = [merged, ...bucket.items.filter((_, i) => i !== idx)]
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
