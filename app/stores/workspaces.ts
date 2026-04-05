import { defineStore } from 'pinia'
import type { Workspace } from '#shared/types/workspace'

type WorkspacesState = {
  items: Workspace[]
  pending: boolean
  error: string | null
  currentWorkspaceId: string | null
}

export const useWorkspacesStore = defineStore('workspaces', {
  state: (): WorkspacesState => ({
    items: [],
    pending: false,
    error: null,
    currentWorkspaceId: null
  }),
  actions: {
    setCurrentWorkspaceId(id: string | null) {
      this.currentWorkspaceId = id
    },
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
    },
    async updateWorkspace(id: number, input: { nome: string; descricao: string | null }) {
      this.pending = true
      this.error = null

      try {
        const updated = await $fetch<Workspace>(`/api/workspace/${id}`, {
          method: 'PATCH',
          body: input
        })
        const idx = this.items.findIndex((w) => w.id === id)
        if (idx !== -1) {
          this.items[idx] = updated
        }
        return updated
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Falha ao atualizar workspace.'
        throw err
      } finally {
        this.pending = false
      }
    },
    async deleteWorkspace(id: number) {
      this.pending = true
      this.error = null

      try {
        await $fetch<{ ok: true; id: number }>(`/api/workspace/${id}`, {
          method: 'DELETE'
        })
        this.items = this.items.filter((w) => w.id !== id)
        if (this.currentWorkspaceId === String(id)) {
          this.setCurrentWorkspaceId(null)
        }
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Falha ao remover workspace.'
        throw err
      } finally {
        this.pending = false
      }
    }
  }
})

