import { defineStore } from 'pinia'
import type { Mensagem, MensagensListResponse, PusherNovaMensagemPayload } from '#shared/types/mensagem'

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

/** Bucket no Pinia = `public.conversas.key` (UUID ou legado). */
export type MensagensBucketKey = string

/** Compat: segundo arg é sempre `conversas.key`. */
export function mensagensKey(_idCanal: number, conversaKey: string): MensagensBucketKey {
  return conversaKey.trim()
}

export function mensagensBucketKey(conversaKey: string): MensagensBucketKey {
  return conversaKey.trim()
}

const MAX_CACHE_KEYS = 5

type KeyMensagensState = {
  /** Canal usado no último GET (paginação “carregar mais”). */
  id_canal: number | null
  items: Mensagem[]
  page: number
  perPage: number
  total: number
  pending: boolean
  error: string | null
  loadedAt: number | null
}

type MensagensState = {
  activeKey: MensagensBucketKey | null
  byKey: Record<MensagensBucketKey, KeyMensagensState>
  keyOrder: MensagensBucketKey[]
}

function emptyKeyState(): KeyMensagensState {
  return {
    id_canal: null,
    items: [],
    page: 1,
    perPage: 30,
    total: 0,
    pending: false,
    error: null,
    loadedAt: null,
  }
}

type FetchOptions = {
  append?: boolean
}

export const useMensagensStore = defineStore('mensagens', {
  state: (): MensagensState => ({
    activeKey: null,
    byKey: {},
    keyOrder: [],
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
    },
  },
  actions: {
    createTempId(): string {
      return `tmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
    },

    addOptimisticTextMessage(input: {
      id_canal: number
      conversa_key: string
      lid?: string | null
      phone?: string | null
      connected_phone?: string | null
      text: string
      name?: string | null
      photo?: string | null
    }): string {
      const tempId = this.createTempId()
      const key = mensagensBucketKey(input.conversa_key)
      const bucket = this.byKey[key] ?? (this.byKey[key] = emptyKeyState())

      this.touchKey(key)
      this.pruneCache()
      if (bucket.loadedAt == null) bucket.loadedAt = Date.now()
      bucket.id_canal = input.id_canal

      const nowIso = new Date().toISOString()
      const msg: Mensagem = {
        key_conversa: key,
        temp_id: tempId,
        message_id: tempId,
        created_at: nowIso,
        from_me: true,
        message: input.text,
        phone: input.phone ?? null,
        lid: input.lid ?? null,
        connected_phone: input.connected_phone ?? null,
        messagetype: 'conversation',
        from_api: true,
        id_canal: input.id_canal,
        media_url: null,
        caption: null,
        filename: null,
        name: input.name ?? null,
        photo: input.photo ?? null,
      }

      bucket.items = [msg, ...bucket.items]
      bucket.total = Math.max(0, (bucket.total ?? 0) + 1)
      return tempId
    },

    addOptimisticMediaMessage(input: {
      id_canal: number
      conversa_key: string
      lid?: string | null
      phone?: string | null
      connected_phone?: string | null
      messagetype: Mensagem['messagetype']
      media_url: string
      caption?: string | null
      filename?: string | null
      name?: string | null
      photo?: string | null
    }): string {
      const tempId = this.createTempId()
      const key = mensagensBucketKey(input.conversa_key)
      const bucket = this.byKey[key] ?? (this.byKey[key] = emptyKeyState())

      this.touchKey(key)
      this.pruneCache()
      if (bucket.loadedAt == null) bucket.loadedAt = Date.now()
      bucket.id_canal = input.id_canal

      const nowIso = new Date().toISOString()
      const msg: Mensagem = {
        key_conversa: key,
        temp_id: tempId,
        message_id: tempId,
        created_at: nowIso,
        from_me: true,
        message: null,
        phone: input.phone ?? null,
        lid: input.lid ?? null,
        connected_phone: input.connected_phone ?? null,
        messagetype: input.messagetype ?? 'conversation',
        from_api: true,
        id_canal: input.id_canal,
        media_url: input.media_url,
        caption: input.caption ?? null,
        filename: input.filename ?? null,
        name: input.name ?? null,
        photo: input.photo ?? null,
      }

      bucket.items = [msg, ...bucket.items]
      bucket.total = Math.max(0, (bucket.total ?? 0) + 1)
      return tempId
    },

    removeByTempId(conversa_key: string, tempId: string) {
      const key = mensagensBucketKey(conversa_key)
      const bucket = this.byKey[key]
      if (!bucket) return
      const before = bucket.items.length
      bucket.items = bucket.items.filter((m) => m.temp_id !== tempId)
      const removed = before - bucket.items.length
      if (removed > 0) bucket.total = Math.max(0, (bucket.total ?? 0) - removed)
    },

    touchKey(key: MensagensBucketKey) {
      const idx = this.keyOrder.indexOf(key)
      if (idx !== -1) this.keyOrder.splice(idx, 1)
      this.keyOrder.push(key)
    },

    pruneCache() {
      while (this.keyOrder.length > MAX_CACHE_KEYS) {
        const oldest = this.keyOrder.shift()
        if (!oldest) break
        if (oldest === this.activeKey) {
          this.keyOrder.push(oldest)
          break
        }
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete this.byKey[oldest]
      }
    },

    setActiveKey(key: MensagensBucketKey | null) {
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
    },

    resetAll() {
      this.byKey = {}
      this.activeKey = null
      this.keyOrder = []
    },

    mergeFromPusherNovaMensagem(canalId: number, payload: PusherNovaMensagemPayload) {
      const mid = payload.mensagem.id_canal
      if (mid != null && mid !== canalId) return

      const key = mensagensBucketKey(payload.conversa_key)
      if (!key) return

      const bucket = this.byKey[key] ?? (this.byKey[key] = emptyKeyState())

      this.touchKey(key)
      this.pruneCache()

      if (bucket.loadedAt == null) bucket.loadedAt = Date.now()
      bucket.id_canal = canalId

      const msg = payload.mensagem

      const tempId = msg.temp_id ?? null
      if (tempId) {
        const idx = bucket.items.findIndex((x) => x.temp_id === tempId)
        if (idx !== -1) {
          const next = [...bucket.items]
          next[idx] = { ...msg, temp_id: null }
          bucket.items = next
          return
        }
      }

      if (bucket.items.some((x) => x.message_id === msg.message_id)) return

      bucket.items = [msg, ...bucket.items]
      bucket.total = Math.max(0, (bucket.total ?? 0) + 1)
    },

    afterConversaDeleted(key: MensagensBucketKey) {
      if (this.activeKey === key) this.activeKey = null
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete this.byKey[key]
      const idx = this.keyOrder.indexOf(key)
      if (idx !== -1) this.keyOrder.splice(idx, 1)
    },

    async fetchPage(idCanal: number, conversaKey: string, page: number = 1, options: FetchOptions = {}) {
      const key = mensagensBucketKey(conversaKey)
      this.setActiveKey(key)
      const bucket = this.byKey[key] ?? (this.byKey[key] = emptyKeyState())

      bucket.pending = true
      bucket.error = null
      bucket.id_canal = idCanal
      try {
        const res = await $fetch<MensagensListResponse>('/api/mensagens', {
          method: 'GET',
          query: {
            id_canal: idCanal,
            key: conversaKey,
            page,
          },
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

    async ensureLoaded(idCanal: number, conversaKey: string, page: number = 1) {
      const key = mensagensBucketKey(conversaKey)
      this.setActiveKey(key)
      const bucket = this.byKey[key] ?? (this.byKey[key] = emptyKeyState())
      if (bucket.loadedAt != null) return
      await this.fetchPage(idCanal, conversaKey, page)
    },

    async fetchNextPage() {
      const key = this.activeKey
      if (!key) return
      const bucket = this.byKey[key] ?? (this.byKey[key] = emptyKeyState())
      if (bucket.pending) return
      if (!(bucket.page * bucket.perPage < bucket.total)) return

      const idCanal = bucket.id_canal
      if (idCanal == null) return

      const nextPage = bucket.page + 1
      await this.fetchPage(idCanal, key, nextPage, { append: true })
    },
  },
})
