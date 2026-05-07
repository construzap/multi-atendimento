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

export type MensagensKey = `${number}-${string}`

export function mensagensKey(idCanal: number, lid: string): MensagensKey {
  return `${idCanal}-${lid}` as MensagensKey
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
  /** Cache por chave composta `id_canal-lid`. */
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
    createTempId(): string {
      // Curto e único o suficiente para UI; conciliado via Pusher.
      return `tmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
    },

    addOptimisticTextMessage(input: {
      id_canal: number
      lid: string
      phone?: string | null
      connected_phone?: string | null
      text: string
      name?: string | null
      photo?: string | null
    }): string {
      const tempId = this.createTempId()
      const key = mensagensKey(input.id_canal, input.lid)
      const bucket = this.byKey[key] ?? (this.byKey[key] = emptyKeyState())

      this.touchKey(key)
      this.pruneCache()
      if (bucket.loadedAt == null) bucket.loadedAt = Date.now()

      const nowIso = new Date().toISOString()
      const msg: Mensagem = {
        temp_id: tempId,
        // placeholder: usado só para evitar undefined; a UI usa temp_id como key.
        message_id: tempId,
        created_at: nowIso,
        from_me: true,
        message: input.text,
        phone: input.phone ?? null,
        lid: input.lid,
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
      lid: string
      phone?: string | null
      connected_phone?: string | null
      /** `MessageType` correspondente (imageMessage/videoMessage/documentMessage/audioMessage). */
      messagetype: Mensagem['messagetype']
      /** URL pública do arquivo (ou placeholder se ainda for gerar). */
      media_url: string
      /** Legenda opcional (vai em `caption`). */
      caption?: string | null
      filename?: string | null
      name?: string | null
      photo?: string | null
    }): string {
      const tempId = this.createTempId()
      const key = mensagensKey(input.id_canal, input.lid)
      const bucket = this.byKey[key] ?? (this.byKey[key] = emptyKeyState())

      this.touchKey(key)
      this.pruneCache()
      if (bucket.loadedAt == null) bucket.loadedAt = Date.now()

      const nowIso = new Date().toISOString()
      const msg: Mensagem = {
        temp_id: tempId,
        message_id: tempId,
        created_at: nowIso,
        from_me: true,
        message: null,
        phone: input.phone ?? null,
        lid: input.lid,
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

    removeByTempId(canalId: number, lid: string, tempId: string) {
      const key = mensagensKey(canalId, lid)
      const bucket = this.byKey[key]
      if (!bucket) return
      const before = bucket.items.length
      bucket.items = bucket.items.filter((m) => m.temp_id !== tempId)
      const removed = before - bucket.items.length
      if (removed > 0) bucket.total = Math.max(0, (bucket.total ?? 0) - removed)
    },

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

    /**
     * Insere `payload.mensagem` no cache desta conversa (mesmo formato do GET /api/mensagens).
     * Mais recente primeiro; ignora duplicata por `message_id`.
     */
    mergeFromPusherNovaMensagem(canalId: number, payload: PusherNovaMensagemPayload) {
      const m = payload.conversa_key.match(/^(\d+)-(.+)$/)
      if (!m) return
      const cid = Number(m[1])
      const lidPart = m[2]
      if (!Number.isFinite(cid) || cid !== canalId || !lidPart) return

      const key = mensagensKey(canalId, lidPart)
      const bucket = this.byKey[key] ?? (this.byKey[key] = emptyKeyState())

      this.touchKey(key)
      this.pruneCache()

      if (bucket.loadedAt == null) bucket.loadedAt = Date.now()

      const msg = payload.mensagem

      const tempId = msg.temp_id ?? null
      // Envio otimista confirmado: substitui a linha temporária pelo payload oficial (`message_id` real, etc.).
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

    /** Após excluir a conversa no backend: limpa cache e `activeKey` se for essa chave. */
    afterConversaDeleted(key: MensagensKey) {
      if (this.activeKey === key) this.activeKey = null
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete this.byKey[key]
      const idx = this.keyOrder.indexOf(key)
      if (idx !== -1) this.keyOrder.splice(idx, 1)
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

      const keyStr = String(key)
      const sepIdx = keyStr.indexOf('-')
      if (sepIdx === -1) return
      const rawCanal = keyStr.slice(0, sepIdx)
      const lid = keyStr.slice(sepIdx + 1)
      const idCanal = Number.parseInt(rawCanal, 10)
      if (!Number.isFinite(idCanal) || !lid) return

      const nextPage = bucket.page + 1
      await this.fetchPage(idCanal, lid, nextPage, { append: true })
    }
  }
})

