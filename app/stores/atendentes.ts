import { defineStore } from 'pinia'
import type { AtendenteListaItem, AtendentesListResponse } from '#shared/types/atendentes'
import { mensagemErroFetch } from '~/stores/canais'

export const useAtendentesStore = defineStore('atendentes', {
  state: () => ({
    items: [] as AtendenteListaItem[],
    /** Se o usuário logado é dono do workspace (pode excluir outros atendentes). */
    souDonoWorkspace: false,
    listPending: false,
    listError: null as string | null,
  }),
  actions: {
    /**
     * GET /api/atendentes — lista atendentes e flag de dono do workspace.
     */
    async fetchList(workspaceId: number) {
      if (!Number.isFinite(workspaceId) || workspaceId < 1) {
        this.items = []
        this.souDonoWorkspace = false
        this.listError = null
        return
      }

      this.items = []
      this.souDonoWorkspace = false
      this.listPending = true
      this.listError = null

      try {
        const res = await $fetch<AtendentesListResponse>('/api/atendentes', {
          method: 'GET',
          query: { workspace_id: workspaceId },
        })
        this.items = res.data ?? []
        this.souDonoWorkspace = Boolean(res.sou_dono_workspace)
      } catch (err) {
        this.items = []
        this.souDonoWorkspace = false
        this.listError = mensagemErroFetch(err, 'Não foi possível carregar os atendentes.')
      } finally {
        this.listPending = false
      }
    },

    reset() {
      this.items = []
      this.souDonoWorkspace = false
      this.listPending = false
      this.listError = null
    },
  },
})
