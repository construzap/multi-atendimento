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
    /** Workspace cuja lista está em `items` (cache). */
    workspaceIdLoaded: null as number | null,
  }),
  actions: {
    /**
     * GET /api/atendentes — lista atendentes e flag de dono do workspace.
     */
    async fetchList(workspaceId: number, options?: { force?: boolean }) {
      if (!Number.isFinite(workspaceId) || workspaceId < 1) {
        this.items = []
        this.souDonoWorkspace = false
        this.listError = null
        this.workspaceIdLoaded = null
        return
      }

      if (
        !options?.force &&
        this.workspaceIdLoaded === workspaceId &&
        !this.listError
      ) {
        return
      }

      const trocouWorkspace = this.workspaceIdLoaded !== workspaceId
      if (trocouWorkspace) {
        this.items = []
        this.souDonoWorkspace = false
      }

      this.listPending = true
      this.listError = null

      try {
        const res = await $fetch<AtendentesListResponse>('/api/atendentes', {
          method: 'GET',
          query: { workspace_id: workspaceId },
        })
        this.items = res.data ?? []
        this.souDonoWorkspace = Boolean(res.sou_dono_workspace)
        this.workspaceIdLoaded = workspaceId
      } catch (err) {
        this.items = []
        this.souDonoWorkspace = false
        this.workspaceIdLoaded = null
        this.listError = mensagemErroFetch(err, 'Não foi possível carregar os atendentes.')
      } finally {
        this.listPending = false
      }
    },

    /** Cache-first: só busca se a lista deste workspace ainda não estiver no Pinia. */
    async ensureListLoaded(workspaceId: number, options?: { force?: boolean }) {
      if (!Number.isFinite(workspaceId) || workspaceId < 1) return
      if (!options?.force && this.workspaceIdLoaded === workspaceId && !this.listError) return
      await this.fetchList(workspaceId, options)
    },

    reset() {
      this.items = []
      this.souDonoWorkspace = false
      this.listPending = false
      this.listError = null
      this.workspaceIdLoaded = null
    },
  },
})
