import { defineStore } from 'pinia'
import type {
  AdminAtualizarPerfilBody,
  AdminGerenciarAssinaturasItemResponse,
  AdminGerenciarAssinaturasListaResponse,
  AdminWorkspaceDoPerfil,
  AdminWorkspacesDoPerfilResponse,
  PerfilConsolidadoRow,
} from '#shared/types/adminGerenciarAssinaturas'
import { mensagemErroFetch } from '~/stores/canais'

export const useAdminGerenciarAssinaturasStore = defineStore('admin-gerenciar-assinaturas', {
  state: () => ({
    perfis: [] as PerfilConsolidadoRow[],
    selectedUserId: null as string | null,
    workspaces: [] as AdminWorkspaceDoPerfil[],
    workspacesPending: false,
    workspacesError: null as string | null,
    workspacesUserId: null as string | null,
    pending: false,
    salvando: false,
    loaded: false,
    error: null as string | null,
  }),

  getters: {
    perfilSelecionado(state): PerfilConsolidadoRow | null {
      if (!state.selectedUserId) return null
      return state.perfis.find((p) => p.user_id === state.selectedUserId) ?? null
    },
  },

  actions: {
    clear() {
      this.perfis = []
      this.selectedUserId = null
      this.workspaces = []
      this.workspacesPending = false
      this.workspacesError = null
      this.workspacesUserId = null
      this.pending = false
      this.salvando = false
      this.loaded = false
      this.error = null
    },

    limparWorkspaces() {
      this.workspaces = []
      this.workspacesPending = false
      this.workspacesError = null
      this.workspacesUserId = null
    },

    async selecionarPerfil(userId: string | null) {
      this.selectedUserId = userId
      if (!userId) {
        this.limparWorkspaces()
        return
      }
      await this.fetchWorkspacesDoPerfil(userId)
    },

    async fetchWorkspacesDoPerfil(userId: string, { force = false } = {}) {
      const id = userId.trim()
      if (!id) {
        this.limparWorkspaces()
        return []
      }

      if (
        !force &&
        this.workspacesUserId === id &&
        !this.workspacesError &&
        !this.workspacesPending
      ) {
        return this.workspaces
      }

      this.workspacesPending = true
      this.workspacesError = null
      this.workspacesUserId = id

      try {
        const res = await $fetch<AdminWorkspacesDoPerfilResponse>(
          '/api/admin/gerenciarassinaturas/workspaces',
          {
            method: 'GET',
            query: { user_id: id },
          },
        )

        // Evita race: só aplica se ainda for o perfil selecionado
        if (this.selectedUserId !== id) return this.workspaces

        this.workspaces = (res.workspaces ?? []).filter((w) => Number.isFinite(w.id))
        return this.workspaces
      } catch (err) {
        if (this.selectedUserId === id) {
          this.workspaces = []
          this.workspacesError = mensagemErroFetch(
            err,
            'Não foi possível carregar os workspaces do perfil.',
          )
        }
        throw err
      } finally {
        if (this.workspacesUserId === id) {
          this.workspacesPending = false
        }
      }
    },

    async fetchLista({ force = false } = {}) {
      if (!force && this.loaded && !this.error) {
        return this.perfis
      }

      this.pending = true
      this.error = null

      try {
        const res = await $fetch<AdminGerenciarAssinaturasListaResponse>(
          '/api/admin/gerenciarassinaturas',
          { method: 'GET' },
        )
        this.perfis = res.perfis ?? []
        this.loaded = true

        if (
          this.selectedUserId &&
          !this.perfis.some((p) => p.user_id === this.selectedUserId)
        ) {
          this.selectedUserId = null
          this.limparWorkspaces()
        }

        return this.perfis
      } catch (err) {
        this.error = mensagemErroFetch(
          err,
          'Não foi possível carregar os perfis.',
        )
        this.perfis = []
        this.loaded = true
        throw err
      } finally {
        this.pending = false
      }
    },

    async atualizarPerfil(body: AdminAtualizarPerfilBody) {
      this.salvando = true
      this.error = null

      try {
        const res = await $fetch<AdminGerenciarAssinaturasItemResponse>(
          '/api/admin/gerenciarassinaturas',
          {
            method: 'POST',
            body,
          },
        )

        const atualizado = res.perfil ?? null
        if (atualizado) {
          const idx = this.perfis.findIndex((p) => p.user_id === atualizado.user_id)
          if (idx >= 0) {
            this.perfis.splice(idx, 1, atualizado)
          } else {
            this.perfis.push(atualizado)
          }
          this.selectedUserId = atualizado.user_id
        }

        return atualizado
      } catch (err) {
        this.error = mensagemErroFetch(
          err,
          'Não foi possível atualizar o perfil.',
        )
        throw err
      } finally {
        this.salvando = false
      }
    },
  },
})
