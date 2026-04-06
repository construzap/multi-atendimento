import { defineStore } from 'pinia'
import type { Conversa, ConversasListResponse } from '#shared/types/conversa'
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

type ConversasState = {
  /** Página atual carregada (última resposta da API). */
  items: Conversa[]
  page: number
  perPage: number
  total: number
  pending: boolean
  error: string | null
}

export const useConversasStore = defineStore('conversas', {
  state: (): ConversasState => ({
    items: [],
    page: 1,
    perPage: 20,
    total: 0,
    pending: false,
    error: null
  }),
  getters: {
    /** Ainda há registros além da página atual (para “carregar mais” depois). */
    hasMore(state): boolean {
      return state.page * state.perPage < state.total
    }
  },
  actions: {
    /** Limpa lista e metadados (ex.: ao sair do canal). */
    reset() {
      this.items = []
      this.page = 1
      this.perPage = 20
      this.total = 0
      this.error = null
    },

    /**
     * GET `/api/conversas` — usa `id_canal` do **canal atual** (`useCanaisStore().currentCanalId`).
     * Se não houver canal selecionado, chama `reset()` e retorna.
     */
    async fetchPage(page: number = 1) {
      const canais = useCanaisStore()
      const idCanal = canais.currentCanalId
      if (idCanal == null) {
        this.reset()
        return
      }

      this.pending = true
      this.error = null
      try {
        const res = await $fetch<ConversasListResponse>('/api/conversas', {
          method: 'GET',
          query: {
            id_canal: idCanal,
            page
          }
        })
        this.items = res.data
        this.page = res.page
        this.perPage = res.perPage
        this.total = res.total
      } catch (err) {
        this.items = []
        this.total = 0
        this.error = mensagemErroFetch(err, 'Não foi possível carregar as conversas.')
        throw err
      } finally {
        this.pending = false
      }
    }
  }
})
