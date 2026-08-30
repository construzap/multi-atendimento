import { defineStore } from 'pinia'
import type { EntregadorListaItem, EntregadoresListResponse } from '#shared/types/entregadores'
import { mensagemErroFetch } from '~/stores/canais'

export const useEntregadoresStore = defineStore('entregadores', {
  state: () => ({
    items: [] as EntregadorListaItem[],
    listPending: false,
    listError: null as string | null,
    loadedWorkspaceId: null as number | null,
  }),

  actions: {
    reset() {
      this.items = []
      this.listPending = false
      this.listError = null
      this.loadedWorkspaceId = null
    },

    async fetchList(workspaceId: number, { force = false } = {}) {
      if (
        !force &&
        this.loadedWorkspaceId === workspaceId &&
        this.items.length >= 0 &&
        !this.listError &&
        !this.listPending
      ) {
        return
      }

      this.listPending = true
      this.listError = null
      try {
        const res = await $fetch<EntregadoresListResponse>('/api/entregadores', {
          query: { workspace_id: workspaceId },
        })
        this.items = res.data ?? []
        this.loadedWorkspaceId = workspaceId
      } catch (err) {
        this.listError = mensagemErroFetch(err, 'Não foi possível carregar entregadores.')
        throw err
      } finally {
        this.listPending = false
      }
    },

    async ensureListLoaded(workspaceId: number) {
      if (this.loadedWorkspaceId === workspaceId && !this.listError) return
      await this.fetchList(workspaceId)
    },

    async create(payload: {
      workspaceId: number
      codigo: string
      nome: string
      ativo?: boolean
      entregador_premium?: boolean
    }) {
      const created = await $fetch<EntregadorListaItem>('/api/entregadores', {
        method: 'POST',
        body: {
          workspace_id: payload.workspaceId,
          codigo: payload.codigo,
          nome: payload.nome,
          ativo: payload.ativo,
          entregador_premium: payload.entregador_premium,
        },
      })
      this.items = [...this.items, created].sort((a, b) =>
        a.codigo.localeCompare(b.codigo, 'pt-BR'),
      )
      return created
    },

    async update(payload: {
      workspaceId: number
      id: number
      codigo?: string
      nome?: string
      ativo?: boolean
      entregador_premium?: boolean
    }) {
      const updated = await $fetch<EntregadorListaItem>('/api/entregadores', {
        method: 'PATCH',
        body: {
          workspace_id: payload.workspaceId,
          id: payload.id,
          codigo: payload.codigo,
          nome: payload.nome,
          ativo: payload.ativo,
          entregador_premium: payload.entregador_premium,
        },
      })
      const idx = this.items.findIndex((i) => i.id === updated.id)
      if (idx >= 0) {
        const next = [...this.items]
        next[idx] = updated
        this.items = next.sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR'))
      } else {
        this.items = [...this.items, updated]
      }
      return updated
    },
  },
})
