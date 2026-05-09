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

    reset() {
      this.funilId = null
      this.funilNome = ''
      this.columns = []
      this.pending = false
      this.error = null
      this.loadedAt = null
      this.workspaceIdLoaded = null
      this.movingKeys = {}
    },
  },
})
