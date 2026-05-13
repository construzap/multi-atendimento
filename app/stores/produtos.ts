import { defineStore } from 'pinia'
import type { ProdutoWorkspaceItem, ProdutosBuscaResponse } from '#shared/types/produtos'
import { mensagemErroFetch } from '~/stores/canais'

export const useProdutosStore = defineStore('produtos', {
  state: () => ({
    items: [] as ProdutoWorkspaceItem[],
    total: 0,
    page: 1,
    pageSize: 20,
    listPending: false,
    listError: null as string | null,
  }),
  getters: {
    totalPages(state): number {
      if (state.total <= 0) return 1
      return Math.ceil(state.total / state.pageSize)
    },
  },
  actions: {
    /**
     * GET /api/produtos/buscar — lista paginada; `q` filtra só pelo nome (ilike).
     */
    async fetchPagina(workspaceId: number, input: { page: number; q: string }) {
      if (!Number.isFinite(workspaceId) || workspaceId < 1) {
        this.reset()
        return
      }

      this.listPending = true
      this.listError = null

      try {
        const res = await $fetch<ProdutosBuscaResponse>('/api/produtos/buscar', {
          method: 'GET',
          query: {
            workspace_id: workspaceId,
            page: input.page,
            page_size: this.pageSize,
            ...(input.q ? { q: input.q } : {}),
          },
        })
        this.items = res.data ?? []
        this.total = res.total
        this.page = res.page
        this.pageSize = res.page_size
      } catch (err) {
        this.items = []
        this.total = 0
        this.listError = mensagemErroFetch(err, 'Não foi possível carregar os produtos.')
      } finally {
        this.listPending = false
      }
    },

    aplicarLinhaAtualizada(row: ProdutoWorkspaceItem) {
      const i = this.items.findIndex((x) => x.id === row.id)
      if (i !== -1) {
        this.items.splice(i, 1, { ...row })
      }
    },

    reset() {
      this.items = []
      this.total = 0
      this.page = 1
      this.pageSize = 20
      this.listPending = false
      this.listError = null
    },
  },
})
