import { defineStore } from 'pinia'
import { toast } from 'vue-sonner'
import type { KanbanBoardResponse, KanbanColumn } from '#shared/types/kanban'
import { mensagemErroFetch } from '~/stores/canais'
import { toRaw } from 'vue'

function cloneColumns(cols: KanbanColumn[]): KanbanColumn[] {
  // `cols` vem do Pinia (objetos reativos/proxy). structuredClone pode falhar em alguns casos.
  return structuredClone(toRaw(cols))
}

export const useKanbanStore = defineStore('kanban', {
  state: () => ({
    funilId: null as number | null,
    funilNome: '' as string,
    columns: [] as KanbanColumn[],
    pending: false,
    error: null as string | null,
    loadedAt: null as number | null,
    workspaceIdLoaded: null as number | null,
    /** Evita double-submit por conversa_key durante drag. */
    movingKeys: {} as Record<string, boolean>,
    /** Durante POST de reordenar colunas (vizinho). */
    reorderingColumnId: null as number | null,
  }),
  actions: {
    async fetchBoard(workspaceId: number) {
      if (!workspaceId) return

      this.pending = true
      this.error = null
      try {
        const res = await $fetch<KanbanBoardResponse>('/api/kanban', {
          method: 'GET',
          query: { workspace_id: workspaceId },
        })
        this.funilId = res.funil_id || null
        this.funilNome = res.funil_nome ?? ''
        this.columns = res.columns ?? []
        this.loadedAt = Date.now()
        this.workspaceIdLoaded = workspaceId
      } catch (err: unknown) {
        this.columns = []
        this.funilId = null
        this.funilNome = ''
        this.error = mensagemErroFetch(err, 'Não foi possível carregar o Kanban.')
        toast.error(this.error, { duration: 8000 })
      } finally {
        this.pending = false
      }
    },

    /**
     * Move card entre colunas (otimista + rollback).
     * `fromColumnId` / `toColumnId`: string numérico do id da coluna (drag payload).
     */
    async moveCard(input: {
      workspaceId: number
      conversaKey: string
      fromColumnId: string
      toColumnId: string
    }) {
      const { workspaceId, conversaKey, fromColumnId, toColumnId } = input
      if (!workspaceId || !conversaKey || fromColumnId === toColumnId) {
        return
      }

      const fromId = Number.parseInt(fromColumnId, 10)
      const toId = Number.parseInt(toColumnId, 10)
      if (!Number.isFinite(fromId) || !Number.isFinite(toId)) {
        return
      }

      if (this.movingKeys[conversaKey]) {
        return
      }
      this.movingKeys[conversaKey] = true
      let snapshot: KanbanColumn[] | null = null
      try {
        snapshot = cloneColumns(this.columns)

        const next = cloneColumns(this.columns)
        const fromCol = next.find((c) => c.id === fromId)
        const toCol = next.find((c) => c.id === toId)
        if (!fromCol || !toCol) {
          return
        }

        const idx = fromCol.cards.findIndex((x) => x.conversa_key === conversaKey)
        if (idx === -1) {
          return
        }

        const [card] = fromCol.cards.splice(idx, 1)
        card.coluna_id = toId
        toCol.cards.unshift(card)
        this.columns = next

        await $fetch('/api/kanban/mover', {
          method: 'POST',
          body: {
            workspace_id: workspaceId,
            conversa_key: conversaKey,
            coluna_id: toId,
          },
        })
      } catch (err: unknown) {
        if (snapshot) this.columns = snapshot
        const msg = mensagemErroFetch(err, 'Não foi possível mover o card.')
        toast.error(msg, { duration: 8000 })
      } finally {
        delete this.movingKeys[conversaKey]
      }
    },

    /**
     * Cria coluna em `funil_workspace_colunas` (ordem calculada no servidor).
     * Usa `funilId` carregado pelo último `fetchBoard`.
     */
    /** Retorna `true` se criou e recarregou o board com sucesso. */
    async createColumn(payload: { workspaceId: number; nome: string; cor: string | null }): Promise<boolean> {
      const fid = this.funilId
      if (!fid || fid < 1) {
        toast.error('Não há funil neste workspace.', { duration: 6000 })
        return false
      }
      if (!payload.workspaceId) return false

      try {
        await $fetch('/api/kanban/coluna', {
          method: 'POST',
          body: {
            workspace_id: payload.workspaceId,
            funil_id: fid,
            nome: payload.nome.trim(),
            cor: payload.cor?.trim() || null,
          },
        })
        await this.fetchBoard(payload.workspaceId)
        return true
      } catch (err: unknown) {
        const msg = mensagemErroFetch(err, 'Não foi possível criar a coluna.')
        toast.error(msg, { duration: 8000 })
        return false
      }
    },

    async updateColumn(payload: {
      workspaceId: number
      colunaId: number
      nome: string
      cor: string | null
    }): Promise<boolean> {
      if (!payload.workspaceId || !payload.colunaId) return false
      try {
        await $fetch('/api/kanban/coluna', {
          method: 'PATCH',
          body: {
            workspace_id: payload.workspaceId,
            coluna_id: payload.colunaId,
            nome: payload.nome.trim(),
            cor: payload.cor?.trim() || null,
          },
        })
        await this.fetchBoard(payload.workspaceId)
        return true
      } catch (err: unknown) {
        const msg = mensagemErroFetch(err, 'Não foi possível atualizar a coluna.')
        toast.error(msg, { duration: 8000 })
        return false
      }
    },

    async reorderColumnAdjacent(payload: {
      workspaceId: number
      colunaId: number
      direcao: 'esquerda' | 'direita'
    }): Promise<boolean> {
      if (!payload.workspaceId || !payload.colunaId) return false
      if (this.reorderingColumnId != null) return false

      this.reorderingColumnId = payload.colunaId
      try {
        await $fetch('/api/kanban/coluna/reordenar', {
          method: 'POST',
          body: {
            workspace_id: payload.workspaceId,
            coluna_id: payload.colunaId,
            direcao: payload.direcao,
          },
        })
        await this.fetchBoard(payload.workspaceId)
        return true
      } catch (err: unknown) {
        const msg = mensagemErroFetch(err, 'Não foi possível reordenar a coluna.')
        toast.error(msg, { duration: 8000 })
        return false
      } finally {
        this.reorderingColumnId = null
      }
    },

    async deleteColumn(payload: { workspaceId: number; colunaId: number }): Promise<boolean> {
      if (!payload.workspaceId || !payload.colunaId) return false
      try {
        await $fetch(
          `/api/kanban/coluna?workspace_id=${payload.workspaceId}&coluna_id=${payload.colunaId}`,
          { method: 'DELETE' },
        )
        await this.fetchBoard(payload.workspaceId)
        toast.success('Coluna excluída.')
        return true
      } catch (err: unknown) {
        const msg = mensagemErroFetch(err, 'Não foi possível excluir a coluna.')
        toast.error(msg, { duration: 8000 })
        return false
      }
    },

    reset() {
      this.funilId = null
      this.funilNome = ''
      this.columns = []
      this.pending = false
      this.error = null
      this.loadedAt = null
      this.workspaceIdLoaded = null
      this.movingKeys = {}
      this.reorderingColumnId = null
    },
  },
})
