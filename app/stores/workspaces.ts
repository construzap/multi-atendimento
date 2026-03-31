import { defineStore } from 'pinia'
import type { Workspace } from '#shared/types/workspace'

type WorkspacesState = {
  items: Workspace[]
  pending: boolean
  error: string | null
}

export const useWorkspacesStore = defineStore('workspaces', {
  state: (): WorkspacesState => ({
    items: [],
    pending: false,
    error: null
  }),
  actions: {
    async fetchAll() {
      this.pending = true
      this.error = null

      try {
        const data = await $fetch<Workspace[]>('/api/workspaces', { method: 'GET' })
        this.items = data
        return data
      } catch (err) {
        this.items = []
        this.error = err instanceof Error ? err.message : 'Falha ao carregar workspaces.'
        throw err
      } finally {
        this.pending = false
      }
    },
    async create(input: { nome: string; descricao?: string | null }) {
      this.pending = true
      this.error = null

      try {
        const created = await $fetch<Workspace>('/api/workspaces', {
          method: 'POST',
          body: input
        })
        // Insere no topo (mais recente)
        this.items = [created, ...this.items]
        return created
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Falha ao criar workspace.'
        throw err
      } finally {
        this.pending = false
      }
    }
  }
})

