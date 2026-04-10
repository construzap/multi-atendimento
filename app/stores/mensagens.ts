import { defineStore } from 'pinia'
import type { Mensagem, MensagensListResponse } from '#shared/types/mensagem'

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

export type MensagensKey = `${number}:${string}`

export function mensagensKey(idCanal: number, lid: string): MensagensKey {
  return `${idCanal}:${lid}` as MensagensKey
}

const MAX_CACHE_KEYS = 5

type KeyMensagensState = {
  items: Mensagem[]
  page: number
  perPage: number
  total: number
  pending: boolean
  error: string | null
  loadedAt: number | null
}

type MensagensState = {
  /** Chave ativa (id_canal + lid) para leitura via getters. */
  activeKey: MensagensKey | null
  /** Cache por chave composta `id_canal:lid`. */
  byKey: Record<MensagensKey, KeyMensagensState>
  /** Ordem LRU (mais antigo → mais recente). */
  keyOrder: MensagensKey[]
}

function emptyKeyState(): KeyMensagensState {
  return {
    items: [],
    page: 1,
    perPage: 30,
    total: 0,
    pending: false,
    error: null,
    loadedAt: null
  }
}

type FetchOptions = {
  append?: boolean
}

export const useMensagensStore = defineStore('mensagens', {
  state: (): MensagensState => ({
    activeKey: null,
    byKey: {},
    keyOrder: []
  }),
  getters: {
    active(state): KeyMensagensState | null {
      if (!state.activeKey) return null
      return state.byKey[state.activeKey] ?? null
    },
    items(state): Mensagem[] {
      const a = state.activeKey ? state.byKey[state.activeKey] : null
      return a?.items ?? []
    },
    pending(state): boolean {
      const a = state.activeKey ? state.byKey[state.activeKey] : null
      return a?.pending ?? false
    },
    error(state): string | null {
      const a = state.activeKey ? state.byKey[state.activeKey] : null
      return a?.error ?? null
    },
    page(state): number {
      const a = state.activeKey ? state.byKey[state.activeKey] : null
      return a?.page ?? 1
    },
    perPage(state): number {
      const a = state.activeKey ? state.byKey[state.activeKey] : null
      return a?.perPage ?? 30
    },
    total(state): number {
      const a = state.activeKey ? state.byKey[state.activeKey] : null
      return a?.total ?? 0
    },
    hasMore(state): boolean {
      const a = state.activeKey ? state.byKey[state.activeKey] : null
      if (!a) return false
      return a.page * a.perPage < a.total
    },
    hasCacheForActive(state): boolean {
      const a = state.activeKey ? state.byKey[state.activeKey] : null
      return Boolean(a && a.loadedAt != null)
    }
  },
  actions: {
    touchKey(key: MensagensKey) {
      const idx = this.keyOrder.indexOf(key)
      if (idx !== -1) this.keyOrder.splice(idx, 1)
      this.keyOrder.push(key)
    },

    pruneCache() {
      // Remove as mais antigas até caber no limite.
      while (this.keyOrder.length > MAX_CACHE_KEYS) {
        const oldest = this.keyOrder.shift()
        if (!oldest) break
        // Evita deletar a chave ativa por segurança.
        if (oldest === this.activeKey) {
          this.keyOrder.push(oldest)
          break
        }
        // `delete` é ok aqui: queremos liberar memória e forçar re-fetch se precisar.
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete this.byKey[oldest]
      }
    },

    setActiveKey(key: MensagensKey | null) {
      this.activeKey = key
      if (!key) return
      if (!this.byKey[key]) this.byKey[key] = emptyKeyState()
      this.touchKey(key)
      this.pruneCache()
    },

    resetActive() {
      if (!this.activeKey) return
      const k = this.activeKey
      this.byKey[k] = emptyKeyState()
      // Opcional: mantém no LRU, pois ainda é uma chave conhecida/recente.
    },

    resetAll() {
      this.byKey = {}
      this.activeKey = null
      this.keyOrder = []
    },

    async fetchPage(idCanal: number, lid: string, page: number = 1, options: FetchOptions = {}) {
      const key = mensagensKey(idCanal, lid)
      this.setActiveKey(key)
      const bucket = this.byKey[key] ?? (this.byKey[key] = emptyKeyState())

      bucket.pending = true
      bucket.error = null
      try {
        const res = await $fetch<MensagensListResponse>('/api/mensagens', {
          method: 'GET',
          query: {
            id_canal: idCanal,
            lid,
            page
          }
        })

        if (options.append) {
          const seen = new Set(bucket.items.map((i) => i.message_id))
          const next = [...bucket.items]
          for (const it of res.data) {
            if (seen.has(it.message_id)) continue
            seen.add(it.message_id)
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
        // Considera essa chave "usada recentemente" e aplica o limite.
        this.touchKey(key)
        this.pruneCache()
      } catch (err) {
        bucket.items = []
        bucket.total = 0
        bucket.error = mensagemErroFetch(err, 'Não foi possível carregar as mensagens.')
        throw err
      } finally {
        bucket.pending = false
      }
    },

    /** Cache-first para uma chave (id_canal + lid). */
    async ensureLoaded(idCanal: number, lid: string, page: number = 1) {
      const key = mensagensKey(idCanal, lid)
      this.setActiveKey(key)
      const bucket = this.byKey[key] ?? (this.byKey[key] = emptyKeyState())
      if (bucket.loadedAt != null) return
      await this.fetchPage(idCanal, lid, page)
    },

    /** Carrega a próxima página para a chave ativa (append). */
    async fetchNextPage() {
      const key = this.activeKey
      if (!key) return
      const bucket = this.byKey[key] ?? (this.byKey[key] = emptyKeyState())
      if (bucket.pending) return
      if (!(bucket.page * bucket.perPage < bucket.total)) return

      const [rawCanal, ...lidParts] = String(key).split(':')
      const idCanal = Number.parseInt(rawCanal, 10)
      const lid = lidParts.join(':')
      if (!Number.isFinite(idCanal) || !lid) return

      const nextPage = bucket.page + 1
      await this.fetchPage(idCanal, lid, nextPage, { append: true })
    }
  }
})

