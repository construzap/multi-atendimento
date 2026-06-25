import { defineStore } from 'pinia'
import type { CampanhaListItem, ListarCampanhasResponse } from '#shared/types/disparoEmMassa'
import { mensagemErroFetch } from '~/stores/canais'

type DisparoEmMassaState = {
  campanhas: CampanhaListItem[]
  workspaceIdLoaded: number | null
  carregado: boolean
  pending: boolean
  error: string | null
  loadedAt: number | null
  /** Campanha aberta no modal de edição (`null` = criar nova). */
  campanhaEdicaoId: string | null
}

export const useDisparoEmMassaStore = defineStore('disparoEmMassa', {
  state: (): DisparoEmMassaState => ({
    campanhas: [],
    workspaceIdLoaded: null,
    carregado: false,
    pending: false,
    error: null,
    loadedAt: null,
    campanhaEdicaoId: null,
  }),

  getters: {
    temCampanhasCarregadas(state): (workspaceId: number) => boolean {
      return (workspaceId: number) =>
        state.carregado && state.workspaceIdLoaded === workspaceId
    },
    campanhaEmEdicao(state): CampanhaListItem | null {
      if (!state.campanhaEdicaoId) return null
      return state.campanhas.find((c) => c.id === state.campanhaEdicaoId) ?? null
    },
  },

  actions: {
    setCampanhaEdicao(id: string | null) {
      this.campanhaEdicaoId = id
    },

    invalidarCampanhas() {
      this.campanhas = []
      this.workspaceIdLoaded = null
      this.carregado = false
      this.loadedAt = null
      this.error = null
      this.campanhaEdicaoId = null
    },

    /**
     * Carrega campanhas do workspace. Se já existir cache para o mesmo workspace,
     * reutiliza os dados do Pinia (use `force: true` para buscar de novo).
     */
    async fetchCampanhas(workspaceId: number, opts?: { force?: boolean }): Promise<CampanhaListItem[]> {
      const force = opts?.force === true

      if (!force && this.temCampanhasCarregadas(workspaceId)) {
        return this.campanhas
      }

      this.pending = true
      this.error = null

      try {
        const data = await $fetch<ListarCampanhasResponse>('/api/kanban/disparo_em_massa', {
          method: 'GET',
          query: { workspace_id: workspaceId },
        })

        this.campanhas = data.campanhas ?? []
        this.workspaceIdLoaded = workspaceId
        this.carregado = true
        this.loadedAt = Date.now()
        return this.campanhas
      } catch (err) {
        this.campanhas = []
        this.carregado = false
        this.workspaceIdLoaded = null
        this.loadedAt = null
        this.error = mensagemErroFetch(err, 'Não foi possível carregar as campanhas.')
        throw err
      } finally {
        this.pending = false
      }
    },
  },
})
