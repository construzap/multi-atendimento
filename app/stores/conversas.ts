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
}

export const useConversasStore = defineStore('conversas', {
  state: (): ConversasState => ({
    activeCanalId: null,
    byCanal: {}
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
    }
  },
  actions: {
    /** Troca o canal ativo (não apaga cache). */
    setActiveCanalId(id: number | null) {
      this.activeCanalId = id
      if (id == null) return
      if (!this.byCanal[id]) this.byCanal[id] = emptyCanalState()
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
        const res = await $fetch<ConversasListResponse>('/api/conversas', {
          method: 'GET',
          query: {
            id_canal: idCanal,
            page
          }
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
      await this.fetchPage(page, canalId)
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
      await this.fetchPage(nextPage, idCanal, { append: true })
    }

    ,
    /**
     * Define a conversa/contato selecionado dentro do canal.
     * `key` é a mesma chave usada na lista (ex.: phone ou lid).
     */
    setConversaAtual(key: string | null, canalId?: number) {
      const idCanal = canalId ?? this.activeCanalId
      if (idCanal == null) return
      const bucket = this.byCanal[idCanal] ?? (this.byCanal[idCanal] = emptyCanalState())
      bucket.conversaAtual = key && key.trim() ? key.trim() : null
    },

    /** Remove da lista local o(s) registro(s) com essa `key` da tabela `conversas` (ex.: após DELETE na API). */
    mergeFromPusherNovaMensagem(canalId: number, payload: PusherNovaMensagemPayload) {
      const bucket = this.byCanal[canalId] ?? (this.byCanal[canalId] = emptyCanalState())
      const msg = payload.mensagem

      // Garante que o canal apareça como "carregado" caso a UI já esteja aberta.
      if (bucket.loadedAt == null) bucket.loadedAt = Date.now()

      const idx = bucket.items.findIndex((c) => c.key === payload.conversa_key)
      const preview = (msg.message ?? msg.caption ?? '').trim() || ' '
      const createdAt = msg.created_at ?? null

      if (idx === -1) {
        const row: Conversa = {
          key: payload.conversa_key,
          message: preview,
          messatype: msg.messagetype ?? null,
          name: msg.from_me ? null : (msg.name ?? null),
          created_at: createdAt,
          updated_at: createdAt,
          id_canal: canalId,
          phone: msg.phone ?? null,
          lid: msg.lid ?? null,
          connect_phone: msg.connected_phone ?? null,
          photo: msg.from_me ? null : (msg.photo ?? null),
          from_me: msg.from_me ?? null,
          media_url: msg.media_url ?? null,
        }
        bucket.items = [row, ...bucket.items]
        bucket.total = Math.max(0, (bucket.total ?? 0) + 1)
        return
      }

      const current = bucket.items[idx]
      const keepIdentity = Boolean(msg.from_me)
      const merged: Conversa = {
        ...current,
        message: preview,
        messatype: msg.messagetype ?? current.messatype,
        from_me: msg.from_me ?? current.from_me,
        media_url: msg.media_url ?? current.media_url,
        updated_at: createdAt ?? current.updated_at,
        name: keepIdentity ? current.name : (msg.name ?? current.name),
        photo: keepIdentity ? current.photo : (msg.photo ?? current.photo),
      }

      // Move para o topo (mais recente)
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
