import { defineStore } from 'pinia'
import { toast } from 'vue-sonner'
import type { KanbanBoardResponse, KanbanCard, KanbanColumn, KanbanColumnPageResponse } from '#shared/types/kanban'
import type { PusherNovaMensagemPayload } from '#shared/types/mensagem'
import { mensagemErroFetch } from '~/stores/canais'
import { useCamposPersonalizadosStore } from '~/stores/camposPersonalizados'
import { useConversasStore } from '~/stores/conversas'
import { toRaw } from 'vue'

function cloneColumns(cols: KanbanColumn[]): KanbanColumn[] {
  // `cols` vem do Pinia (objetos reativos/proxy). structuredClone pode falhar em alguns casos.
  return structuredClone(toRaw(cols))
}

function normalizeKanbanCard(card: KanbanCard): KanbanCard {
  const rawCanal = card.id_canal
  const id_canal =
    rawCanal != null && Number.isFinite(Number(rawCanal)) && Number(rawCanal) >= 1
      ? Number(rawCanal)
      : null

  let is_group: boolean | null = null
  if (card.is_group === true) is_group = true
  else if (card.is_group === false) is_group = false

  const rawNaoLidas = card.nao_lidas
  const nao_lidas =
    rawNaoLidas != null && Number.isFinite(Number(rawNaoLidas))
      ? Math.max(0, Math.trunc(Number(rawNaoLidas)))
      : 0

  return {
    ...card,
    id_canal,
    is_group,
    lid: typeof card.lid === 'string' && card.lid.trim() ? card.lid.trim() : null,
    nao_lidas,
    campos_personalizados: Array.isArray(card.campos_personalizados)
      ? card.campos_personalizados.map((c) => ({ ...c }))
      : [],
  }
}

function hidratarCamposPersonalizadosNoPinia(workspaceId: number, cards: KanbanCard[]) {
  if (!workspaceId || cards.length === 0) return
  const camposStore = useCamposPersonalizadosStore()
  camposStore.hidratarValoresDoKanban(workspaceId, cards)
}

function normalizeKanbanColumn(col: KanbanColumn): KanbanColumn {
  return {
    ...col,
    total_cards: col.total_cards ?? col.cards.length,
    has_more: col.has_more ?? false,
    cards: (col.cards ?? []).map(normalizeKanbanCard),
  }
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
    /** Carregando mais cards por coluna (`coluna_id`). */
    loadingMoreByColumn: {} as Record<number, boolean>,
    /** `conversa_key` do card aberto no modal de info (null = fechado). */
    infoContatoConversaKey: null as string | null,
    /** Filtro atual por nome ou telefone (GET /api/kanban?q=). */
    busca: '' as string,
  }),
  getters: {
    infoContatoCard(state) {
      const key = state.infoContatoConversaKey
      if (!key) return null
      for (const col of state.columns) {
        const card = col.cards.find((c) => c.conversa_key === key)
        if (card) return card
      }
      return null
    },
    infoContatoColumn(state) {
      const key = state.infoContatoConversaKey
      if (!key) return null
      for (const col of state.columns) {
        if (col.cards.some((c) => c.conversa_key === key)) return col
      }
      return null
    },
    /** `conversas.id_canal` do card aberto no modal (via Pinia kanban). */
    infoContatoIdCanal(): number | null {
      const card = this.infoContatoCard
      if (!card?.id_canal || card.id_canal < 1) return null
      return card.id_canal
    },
    /** `conversas.is_group` do card aberto no modal (via Pinia kanban). */
    infoContatoEhGrupo(): boolean {
      return this.infoContatoCard?.is_group === true
    },
  },
  actions: {
    kanbanQuery(workspaceId: number, extra: Record<string, string | number> = {}) {
      const query: Record<string, string | number> = {
        workspace_id: workspaceId,
        ...extra,
      }
      const q = this.busca.trim()
      if (q) query.q = q
      return query
    },

    async fetchBoard(workspaceId: number) {
      if (!workspaceId) return

      this.pending = true
      this.error = null
      try {
        const res = await $fetch<KanbanBoardResponse>('/api/kanban', {
          method: 'GET',
          query: this.kanbanQuery(workspaceId),
        })
        this.funilId = res.funil_id || null
        this.funilNome = res.funil_nome ?? ''
        this.columns = (res.columns ?? []).map(normalizeKanbanColumn)
        this.loadedAt = Date.now()
        this.workspaceIdLoaded = workspaceId
        hidratarCamposPersonalizadosNoPinia(
          workspaceId,
          this.columns.flatMap((col) => col.cards),
        )
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
     * Cache-first: só busca se o board deste workspace ainda não estiver no Pinia.
     * Use `fetchBoard` ou `{ force: true }` após mutações (mover card, busca, etc.).
     */
    async ensureBoardLoaded(workspaceId: number, options?: { force?: boolean }) {
      if (!workspaceId) return
      if (
        !options?.force &&
        this.loadedAt != null &&
        this.workspaceIdLoaded === workspaceId
      ) {
        return
      }
      await this.fetchBoard(workspaceId)
    },

    async loadMoreCards(payload: { workspaceId: number; colunaId: number }) {
      const { workspaceId, colunaId } = payload
      if (!workspaceId || !colunaId) return

      const col = this.columns.find((c) => c.id === colunaId)
      if (!col || !col.has_more || this.loadingMoreByColumn[colunaId]) {
        return
      }

      this.loadingMoreByColumn = { ...this.loadingMoreByColumn, [colunaId]: true }
      try {
        const res = await $fetch<KanbanColumnPageResponse>('/api/kanban', {
          method: 'GET',
          query: this.kanbanQuery(workspaceId, {
            coluna_id: colunaId,
            offset: col.cards.length,
          }),
        })

        const next = cloneColumns(this.columns)
        const target = next.find((c) => c.id === colunaId)
        if (!target) return

        const existing = new Set(target.cards.map((c) => c.conversa_key))
        for (const card of res.cards) {
          if (!existing.has(card.conversa_key)) {
            target.cards.push(normalizeKanbanCard(card))
          }
        }
        target.total_cards = res.total_cards
        target.has_more = res.has_more
        this.columns = next
        hidratarCamposPersonalizadosNoPinia(workspaceId, res.cards)
      } catch (err: unknown) {
        const msg = mensagemErroFetch(err, 'Não foi possível carregar mais cards.')
        toast.error(msg, { duration: 8000 })
      } finally {
        const { [colunaId]: _removed, ...rest } = this.loadingMoreByColumn
        this.loadingMoreByColumn = rest
      }
    },

    async applyBusca(workspaceId: number, termo: string) {
      this.busca = termo.trim()
      await this.fetchBoard(workspaceId)
    },

    openInfoContatoConversa(conversaKey: string) {
      const key = conversaKey?.trim()
      if (!key) return
      this.infoContatoConversaKey = key

      const naoLidas = this._naoLidasDoCard(key)
      this.zerarNaoLidasPorConversaKey(key)

      if (naoLidas > 0) {
        void this.marcarComoLidaConversa(key)
      }
    },

    closeInfoContatoConversa() {
      this.infoContatoConversaKey = null
    },

    /** Zera badge de não lidas no card do board (ex.: ao abrir o modal de chat). */
    zerarNaoLidasPorConversaKey(conversaKey: string) {
      const key = conversaKey?.trim()
      if (!key) return

      let changed = false
      const next = cloneColumns(this.columns)
      for (const col of next) {
        const idx = col.cards.findIndex((c) => c.conversa_key === key)
        if (idx === -1) continue
        const current = col.cards[idx]!
        if ((current.nao_lidas ?? 0) === 0) break
        col.cards[idx] = normalizeKanbanCard({ ...current, nao_lidas: 0 })
        changed = true
        break
      }
      if (changed) this.columns = next
    },

    /** Atualiza um valor de campo personalizado no card do board (espelha POST sem novo GET). */
    atualizarCampoPersonalizadoNoCard(
      conversaKey: string,
      campo: { id: number; nome: string; tipo: KanbanCard['campos_personalizados'][number]['tipo']; valor: string | null },
    ) {
      const key = conversaKey?.trim()
      if (!key) return

      let changed = false
      const next = cloneColumns(this.columns)
      for (const col of next) {
        const idx = col.cards.findIndex((c) => c.conversa_key === key)
        if (idx === -1) continue

        const current = col.cards[idx]!
        const campos = [...(current.campos_personalizados ?? [])]
        const campoIdx = campos.findIndex((c) => c.id === campo.id)
        if (campoIdx >= 0) {
          campos[campoIdx] = { ...campos[campoIdx]!, valor: campo.valor }
        } else {
          campos.push({ ...campo })
        }

        col.cards[idx] = normalizeKanbanCard({
          ...current,
          campos_personalizados: campos,
        })
        changed = true
        break
      }
      if (changed) this.columns = next
    },

    /** Remove um campo personalizado do card do board (ex.: após exclusão da definição). */
    removerCampoPersonalizadoDoCard(conversaKey: string, campoId: number) {
      const key = conversaKey?.trim()
      if (!key || !Number.isFinite(campoId) || campoId < 1) return

      let changed = false
      const next = cloneColumns(this.columns)
      for (const col of next) {
        const idx = col.cards.findIndex((c) => c.conversa_key === key)
        if (idx === -1) continue

        const current = col.cards[idx]!
        const campos = (current.campos_personalizados ?? []).filter((c) => c.id !== campoId)
        if (campos.length === (current.campos_personalizados ?? []).length) break

        col.cards[idx] = normalizeKanbanCard({
          ...current,
          campos_personalizados: campos,
        })
        changed = true
        break
      }
      if (changed) this.columns = next
    },

    /** Lê `nao_lidas` do card no board (antes de zerar no modal). */
    _naoLidasDoCard(conversaKey: string): number {
      const key = conversaKey?.trim()
      if (!key) return 0

      for (const col of this.columns) {
        const card = col.cards.find((c) => c.conversa_key === key)
        if (card) return card.nao_lidas ?? 0
      }

      return 0
    },

    /** Persiste leitura no banco (`POST /api/conversas/marcar-lidas`) e espelha no cache de conversas. */
    async marcarComoLidaConversa(conversaKey: string) {
      const key = conversaKey?.trim()
      if (!key || key.startsWith('temp:')) return

      try {
        await $fetch('/api/conversas/marcar-lidas', {
          method: 'POST',
          body: { key },
        })
      } catch {
        return
      }

      const conversas = useConversasStore()
      for (const bucket of Object.values(conversas.byCanal)) {
        const idx = bucket.items.findIndex((c) => c.key === key)
        if (idx !== -1) {
          bucket.items[idx] = { ...bucket.items[idx]!, nao_lidas: 0 }
        }
      }
    },

    /**
     * Evento Pusher `nova-mensagem` (disparado pelo webhook): atualiza preview,
     * horário e contador de não lidas no card correspondente.
     */
    mergeFromPusherNovaMensagem(_canalId: number, payload: PusherNovaMensagemPayload) {
      const conversaKey = payload.conversa_key?.trim()
      if (!conversaKey) return

      const msg = payload.mensagem
      const preview = (msg.message ?? msg.caption ?? '').trim() || ' '
      const createdAt = msg.created_at ?? null

      let changed = false
      const next = cloneColumns(this.columns)

      for (const col of next) {
        const idx = col.cards.findIndex((c) => c.conversa_key === conversaKey)
        if (idx === -1) continue

        const current = col.cards[idx]!
        const merged: KanbanCard = {
          ...current,
          preview,
          updated_at: createdAt ?? current.updated_at,
        }

        if (msg.from_me === false && this.infoContatoConversaKey !== conversaKey) {
          merged.nao_lidas = (current.nao_lidas ?? 0) + 1
        }

        if (payload.is_group) {
          merged.is_group = true
          merged.name = payload.name_group ?? current.name
          merged.photo = payload.conversa_photo ?? current.photo
        } else {
          merged.name = msg.name ?? current.name
          merged.photo = msg.photo ?? current.photo
        }

        const normalized = normalizeKanbanCard(merged)
        col.cards.splice(idx, 1)
        col.cards.unshift(normalized)
        changed = true
        break
      }

      if (changed) this.columns = next
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
        fromCol.total_cards = Math.max(0, (fromCol.total_cards ?? fromCol.cards.length + 1) - 1)
        toCol.total_cards = (toCol.total_cards ?? toCol.cards.length - 1) + 1
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
      this.loadingMoreByColumn = {}
      this.infoContatoConversaKey = null
      this.busca = ''
    },
  },
})
