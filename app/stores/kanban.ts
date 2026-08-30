import { defineStore } from 'pinia'
import { toast } from 'vue-sonner'
import type { KanbanBoardResponse, KanbanCard, KanbanColumn, KanbanColumnPageResponse, KanbanConversaAtualizarResponse, KanbanConversaPatch, KanbanCriarFunilResponse, KanbanFunilColunaResumo, KanbanFunilItem, KanbanListarFunisResponse, PusherKanbanAtualizacaoPayload } from '#shared/types/kanban'
import {
  normalizeEntregaStatus,
  normalizeProdutosRaw,
  normalizeTotalOrcamento,
} from '#shared/utils/notificacaoIaProdutos'
import type { Conversa } from '#shared/types/conversa'
import type { PusherNovaMensagemPayload } from '#shared/types/mensagem'
import { mensagemErroFetch } from '~/stores/canais'
import { useCamposPersonalizadosStore } from '~/stores/camposPersonalizados'
import { useConversasStore } from '~/stores/conversas'
import { useMensagensStore } from '~/stores/mensagens'
import { useMensagensProntasStore } from '~/stores/mensagensProntas'
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

  let conversa_aberta: boolean | null = null
  if (card.conversa_aberta === true) conversa_aberta = true
  else if (card.conversa_aberta === false) conversa_aberta = false

  let ia_ligada: boolean | null = null
  if (card.ia_ligada === true) ia_ligada = true
  else if (card.ia_ligada === false) ia_ligada = false

  const rawNaoLidas = card.nao_lidas
  const nao_lidas =
    rawNaoLidas != null && Number.isFinite(Number(rawNaoLidas))
      ? Math.max(0, Math.trunc(Number(rawNaoLidas)))
      : 0

  return {
    ...card,
    id_canal,
    is_group,
    name_group: typeof card.name_group === 'string' && card.name_group.trim() ? card.name_group.trim() : card.name_group ?? null,
    conversa_aberta,
    ia_ligada,
    lid: typeof card.lid === 'string' && card.lid.trim() ? card.lid.trim() : null,
    nao_lidas,
    campos_personalizados: Array.isArray(card.campos_personalizados)
      ? card.campos_personalizados.map((c) => ({ ...c }))
      : [],
    notificacoes_ia: Array.isArray(card.notificacoes_ia)
      ? card.notificacoes_ia.map((n) => ({
          ...n,
          produtos: normalizeProdutosRaw(n.produtos),
          total_orcamento: normalizeTotalOrcamento(n.total_orcamento),
          entrega_status: normalizeEntregaStatus(n.entrega_status),
          id_cobranca:
            typeof n.id_cobranca === 'string' && n.id_cobranca.trim()
              ? n.id_cobranca.trim()
              : n.id_cobranca ?? null,
          pagamento_realizado: n.pagamento_realizado === true,
          endereco:
            typeof n.endereco === 'string' && n.endereco.trim()
              ? n.endereco.trim()
              : n.endereco ?? null,
          token_entrega:
            typeof n.token_entrega === 'string' && n.token_entrega.trim()
              ? n.token_entrega.trim().toLowerCase()
              : null,
        }))
      : [],
  }
}

function hidratarCamposPersonalizadosNoPinia(workspaceId: number, cards: KanbanCard[]) {
  if (!workspaceId || cards.length === 0) return
  const camposStore = useCamposPersonalizadosStore()
  camposStore.hidratarValoresDoKanban(workspaceId, cards)
}

function parseIdAgendamento(raw: unknown): string | null {
  if (raw == null || raw === '') return null
  const s = String(raw).trim()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return null
  return s
}

function normalizeKanbanColumn(col: KanbanColumn): KanbanColumn {
  return {
    ...col,
    id_agendamento_mensagem: parseIdAgendamento(col.id_agendamento_mensagem),
    recolhida: col.recolhida === true,
    total_cards: col.total_cards ?? col.cards.length,
    has_more: col.has_more ?? false,
    cards: (col.cards ?? []).map(normalizeKanbanCard),
  }
}

function normalizeFunilColunaResumo(raw: KanbanFunilColunaResumo): KanbanFunilColunaResumo {
  const ordemRaw = raw.ordem
  const ordem =
    ordemRaw != null && Number.isFinite(Number(ordemRaw)) ? Math.trunc(Number(ordemRaw)) : 0
  const corRaw = raw.cor
  const cor =
    typeof corRaw === 'string' && corRaw.trim() ? corRaw.trim() : corRaw != null ? String(corRaw) : null

  return {
    id: Math.trunc(raw.id),
    nome: String(raw.nome ?? '').trim(),
    cor,
    ordem,
  }
}

function colunasBoardParaResumoFunil(cols: KanbanColumn[]): KanbanFunilColunaResumo[] {
  return cols.map((c) =>
    normalizeFunilColunaResumo({
      id: c.id,
      nome: c.nome,
      cor: c.cor,
      ordem: c.ordem,
    }),
  )
}

function normalizeFunilItem(raw: KanbanFunilItem): KanbanFunilItem {
  const ordemRaw = raw.ordem
  const ordem =
    ordemRaw != null && Number.isFinite(Number(ordemRaw)) && Number(ordemRaw) >= 1
      ? Math.trunc(Number(ordemRaw))
      : 1

  return {
    id: Math.trunc(raw.id),
    nome: String(raw.nome ?? '').trim(),
    workspace_id: Math.trunc(raw.workspace_id),
    ordem,
    created_at: String(raw.created_at ?? ''),
    updated_at: raw.updated_at != null && String(raw.updated_at).trim() ? String(raw.updated_at) : null,
    columns: (raw.columns ?? []).map(normalizeFunilColunaResumo),
  }
}

function syncFunilColumnsInList(
  funis: KanbanFunilItem[],
  funilId: number,
  columns: KanbanFunilColunaResumo[],
): KanbanFunilItem[] {
  const idx = funis.findIndex((f) => f.id === funilId)
  if (idx < 0) return funis
  const next = [...funis]
  next[idx] = { ...next[idx]!, columns: columns.map(normalizeFunilColunaResumo) }
  return next
}

export const useKanbanStore = defineStore('kanban', {
  state: () => ({
    funilId: null as number | null,
    funilNome: '' as string,
    /** Funis do workspace atual (`funil_workspace`). */
    funis: [] as KanbanFunilItem[],
    funisPending: false,
    funisError: null as string | null,
    funisWorkspaceIdLoaded: null as number | null,
    columns: [] as KanbanColumn[],
    pending: false,
    error: null as string | null,
    loadedAt: null as number | null,
    workspaceIdLoaded: null as number | null,
    funilIdLoaded: null as number | null,
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
    /** Quando true, GET usa `is_group=false` (oculta grupos WhatsApp). */
    ocultarGrupos: true,
    /** Filtro por canal (`id_canal`); `null` = todos os canais. */
    filtroCanalId: null as number | null,
    /**
     * Quando o toast de pedido novo pede "Abrir", o `KanbanCard` com essa key
     * abre o modal de notificações I.A. e zera o valor.
     */
    openNotificacoesConversaKey: null as string | null,
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
    kanbanQuery(workspaceId: number, extra: Record<string, string | number | boolean> = {}) {
      const query: Record<string, string | number | boolean> = {
        workspace_id: workspaceId,
        ...extra,
      }
      if (
        !('funil_id' in query) &&
        this.funilIdLoaded != null &&
        this.funilIdLoaded > 0
      ) {
        query.funil_id = this.funilIdLoaded
      }
      const q = this.busca.trim()
      if (q) query.q = q
      if (this.ocultarGrupos) query.is_group = false
      if (this.filtroCanalId != null && this.filtroCanalId > 0) {
        query.id_canal = this.filtroCanalId
      }
      return query
    },

    async fetchBoard(workspaceId: number, funilId: number) {
      if (!workspaceId || !funilId) return

      if (this.funilIdLoaded !== funilId) {
        this.columns = []
      }

      this.pending = true
      this.error = null
      try {
        const res = await $fetch<KanbanBoardResponse>('/api/kanban', {
          method: 'GET',
          query: this.kanbanQuery(workspaceId, { funil_id: funilId }),
        })
        this.funilId = res.funil_id || null
        this.funilNome = res.funil_nome ?? ''
        this.columns = (res.columns ?? []).map(normalizeKanbanColumn)
        this.loadedAt = Date.now()
        this.workspaceIdLoaded = workspaceId
        this.funilIdLoaded = funilId
        this.funis = syncFunilColumnsInList(
          this.funis,
          funilId,
          colunasBoardParaResumoFunil(this.columns),
        )
        hidratarCamposPersonalizadosNoPinia(
          workspaceId,
          this.columns.flatMap((col) => col.cards),
        )
      } catch (err: unknown) {
        this.columns = []
        this.funilId = null
        this.funilNome = ''
        this.funilIdLoaded = null
        this.error = mensagemErroFetch(err, 'Não foi possível carregar o Kanban.')
        toast.error(this.error, { duration: 8000 })
      } finally {
        this.pending = false
      }
    },

    async refetchCurrentBoard(workspaceId: number) {
      const fid = this.funilIdLoaded ?? this.funilId
      if (!workspaceId || !fid) return
      await this.fetchBoard(workspaceId, fid)
    },

    async fetchFunis(workspaceId: number) {
      if (!workspaceId) return []

      this.funisPending = true
      this.funisError = null
      try {
        const res = await $fetch<KanbanListarFunisResponse>('/api/kanban/funil', {
          method: 'GET',
          query: { workspace_id: workspaceId },
        })
        this.funis = (res.funis ?? []).map(normalizeFunilItem)
        this.funisWorkspaceIdLoaded = workspaceId
        return this.funis
      } catch (err: unknown) {
        this.funis = []
        this.funisWorkspaceIdLoaded = null
        this.funisError = mensagemErroFetch(err, 'Não foi possível carregar os funis.')
        throw err
      } finally {
        this.funisPending = false
      }
    },

    /** Cache-first: só busca funis se ainda não houver lista para este workspace. */
    async ensureFunisLoaded(workspaceId: number, options?: { force?: boolean }) {
      if (!workspaceId) return
      if (!options?.force && this.funisWorkspaceIdLoaded === workspaceId) return
      await this.fetchFunis(workspaceId)
    },

    /** Percorre `funis[].columns` e devolve o funil dono da coluna (ou `null`). */
    findFunilIdByColunaId(colunaId: number): number | null {
      const id = Number(colunaId)
      if (!Number.isFinite(id) || id < 1) return null
      for (const funil of this.funis) {
        if (funil.columns?.some((c) => Number(c.id) === id)) return funil.id
      }
      return null
    },

    /**
     * Resolve o `id` da coluna com `ordem` no funil atual.
     * Preferência: `columns` do board → `funis[].columns` → fetch de funis se faltar.
     */
    async resolveColunaIdPorOrdem(
      workspaceId: number,
      ordem: number,
      funilId?: number | null,
    ): Promise<number | null> {
      if (!workspaceId || !Number.isFinite(ordem) || ordem < 1) return null

      const wsId = Number(workspaceId)
      const fidPreferido =
        funilId
        ?? (this.workspaceIdLoaded === wsId ? this.funilIdLoaded ?? this.funilId : null)
        ?? this.funilId

      const fromBoard = (): number | null => {
        if (Number(this.workspaceIdLoaded) !== wsId || this.columns.length === 0) return null
        const col = this.columns.find((c) => Number(c.ordem) === Number(ordem))
        return col?.id ?? null
      }

      const fromFunis = (): number | null => {
        if (Number(this.funisWorkspaceIdLoaded) !== wsId || this.funis.length === 0) return null
        const funil =
          (fidPreferido != null
            ? this.funis.find((f) => f.id === fidPreferido)
            : null)
          ?? this.funis.find((f) => f.ordem === 1)
          ?? this.funis[0]
          ?? null
        const col = funil?.columns?.find((c) => Number(c.ordem) === Number(ordem))
        return col?.id ?? null
      }

      const boardId = fromBoard()
      if (boardId != null) return boardId

      const funilIdLocal = fromFunis()
      if (funilIdLocal != null) return funilIdLocal

      await this.ensureFunisLoaded(wsId)
      const aposEnsure = fromFunis() ?? fromBoard()
      if (aposEnsure != null) return aposEnsure

      await this.ensureFunisLoaded(wsId, { force: true })
      return fromFunis() ?? fromBoard()
    },

    /**
     * Move a conversa para a coluna de determinada `ordem` (ex.: 4 = Em Separação).
     * Usa Pinia (`funis` / `columns`); busca funis se ainda não estiverem carregados.
     * Sempre dispara `POST /api/kanban/mover` quando a coluna destino é diferente da atual.
     */
    async moverConversaParaColunaOrdem(input: {
      workspaceId: number
      conversaKey: string
      ordem: number
      funilId?: number | null
    }): Promise<boolean> {
      const key = input.conversaKey?.trim()
      const workspaceId = Number(input.workspaceId)
      if (!key || !Number.isFinite(workspaceId) || workspaceId < 1) return false

      const toColunaId = await this.resolveColunaIdPorOrdem(
        workspaceId,
        input.ordem,
        input.funilId,
      )
      if (!toColunaId) {
        toast.error(`Coluna de ordem ${input.ordem} não encontrada neste funil.`, {
          duration: 6000,
        })
        return false
      }

      let fromColunaId: number | null = null
      for (const col of this.columns) {
        if (col.cards.some((c) => c.conversa_key === key)) {
          fromColunaId = col.id
          break
        }
      }
      // Fallback: coluna_id no próprio card (mesmo se não estiver na lista filtrada).
      if (fromColunaId == null) {
        for (const col of this.columns) {
          const card = col.cards.find((c) => c.conversa_key === key)
          if (card?.coluna_id) {
            fromColunaId = card.coluna_id
            break
          }
        }
      }

      if (fromColunaId != null && fromColunaId === toColunaId) {
        return true
      }

      if (fromColunaId != null) {
        await this.moveCard({
          workspaceId,
          conversaKey: key,
          fromColumnId: String(fromColunaId),
          toColumnId: String(toColunaId),
        })
        return true
      }

      // Card fora do board visível: só persiste no banco.
      try {
        await $fetch('/api/kanban/mover', {
          method: 'POST',
          body: {
            workspace_id: workspaceId,
            conversa_key: key,
            coluna_id: toColunaId,
          },
        })
        await this.dispararAgendamentoDaColunaSeHouver({
          workspaceId,
          colunaId: toColunaId,
          conversaKey: key,
        })
        return true
      } catch (err: unknown) {
        toast.error(mensagemErroFetch(err, 'Não foi possível mover a conversa.'), {
          duration: 8000,
        })
        return false
      }
    },

    adicionarFunilCriado(res: KanbanCriarFunilResponse) {
      const item = normalizeFunilItem({
        id: res.id,
        nome: res.nome,
        workspace_id: res.workspace_id,
        ordem: res.ordem,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        columns: res.columns ?? [],
      })
      const idx = this.funis.findIndex((f) => f.id === item.id)
      if (idx >= 0) {
        this.funis[idx] = item
      } else {
        this.funis = [...this.funis, item]
      }
      this.funisWorkspaceIdLoaded = res.workspace_id
    },

    /**
     * Cache-first: só busca se o board deste workspace ainda não estiver no Pinia.
     * Use `fetchBoard` ou `{ force: true }` após mutações (mover card, busca, etc.).
     */
    async ensureBoardLoaded(workspaceId: number, funilId?: number, options?: { force?: boolean }) {
      if (!workspaceId) return

      let fid =
        funilId ??
        (this.workspaceIdLoaded === workspaceId ? this.funilIdLoaded ?? this.funilId : null) ??
        null

      if (!fid) {
        await this.ensureFunisLoaded(workspaceId)
        fid = this.funis.find((f) => f.ordem === 1)?.id ?? this.funis[0]?.id ?? null
      }

      if (!fid) return

      if (
        !options?.force &&
        this.loadedAt != null &&
        this.workspaceIdLoaded === workspaceId &&
        this.funilIdLoaded === fid
      ) {
        return
      }
      await this.fetchBoard(workspaceId, fid)
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
      await this.refetchCurrentBoard(workspaceId)
    },

    async setOcultarGrupos(workspaceId: number, ocultar: boolean) {
      this.ocultarGrupos = ocultar
      this.loadingMoreByColumn = {}
      await this.refetchCurrentBoard(workspaceId)
    },

    /** `null` = todos os canais. */
    async setFiltroCanalId(workspaceId: number, canalId: number | null) {
      const id =
        canalId != null && Number.isFinite(canalId) && canalId > 0 ? Math.trunc(canalId) : null
      this.filtroCanalId = id
      this.loadingMoreByColumn = {}
      await this.refetchCurrentBoard(workspaceId)
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

    atualizarNomeNoCard(conversaKey: string, name: string | null) {
      this.aplicarConversaAtualizadaNoCard({ conversa_key: conversaKey, name } as KanbanConversaAtualizarResponse)
    },

    aplicarConversaAtualizadaNoCard(
      res: KanbanConversaAtualizarResponse,
      extras?: { canal_nome?: string | null },
    ) {
      const key = res.conversa_key?.trim()
      if (!key) return

      let changed = false
      const next = cloneColumns(this.columns)
      for (const col of next) {
        const idx = col.cards.findIndex((c) => c.conversa_key === key)
        if (idx === -1) continue

        const cur = col.cards[idx]!
        col.cards[idx] = normalizeKanbanCard({
          ...cur,
          ...(res.name !== undefined ? { name: res.name } : {}),
          ...(res.phone !== undefined ? { phone: res.phone } : {}),
          ...(res.lid !== undefined ? { lid: res.lid } : {}),
          ...(res.photo !== undefined ? { photo: res.photo } : {}),
          ...(res.updated_at !== undefined ? { updated_at: res.updated_at } : {}),
          ...(res.id_canal !== undefined ? { id_canal: res.id_canal } : {}),
          ...(extras?.canal_nome !== undefined ? { canal_nome: extras.canal_nome } : {}),
          ...(res.is_group !== undefined ? { is_group: res.is_group } : {}),
          ...(res.name_group !== undefined ? { name_group: res.name_group } : {}),
          ...(res.conversa_aberta !== undefined ? { conversa_aberta: res.conversa_aberta } : {}),
          ...(res.ia_ligada !== undefined ? { ia_ligada: res.ia_ligada } : {}),
        })
        changed = true
        break
      }
      if (changed) this.columns = next
    },

    /**
     * Espelha conversa salva via chat no board já carregado no Pinia.
     * Não faz nada se o kanban deste workspace ainda não estiver em cache.
     */
    espelharConversaAtualizadaNoBoard(workspaceId: number, conversa: Conversa) {
      const key = conversa.key?.trim()
      if (!key || !workspaceId) return
      if (this.loadedAt == null || this.workspaceIdLoaded !== workspaceId) return

      const next = cloneColumns(this.columns)
      let fromColIdx = -1
      let cardIdx = -1

      for (let i = 0; i < next.length; i++) {
        const idx = next[i]!.cards.findIndex((c) => c.conversa_key === key)
        if (idx !== -1) {
          fromColIdx = i
          cardIdx = idx
          break
        }
      }

      if (fromColIdx === -1 || cardIdx === -1) return

      const fromCol = next[fromColIdx]!
      const current = fromCol.cards[cardIdx]!
      const novoColunaId =
        conversa.coluna_id != null && conversa.coluna_id > 0
          ? conversa.coluna_id
          : current.coluna_id

      const updatedCard = normalizeKanbanCard({
        ...current,
        name: conversa.name,
        phone: conversa.phone,
        lid: conversa.lid,
        updated_at: conversa.updated_at,
        coluna_id: novoColunaId,
        ia_ligada: conversa.ia_ligada,
      })

      const targetColIdx = next.findIndex((c) => c.id === novoColunaId)

      if (targetColIdx !== -1 && targetColIdx !== fromColIdx) {
        fromCol.cards.splice(cardIdx, 1)
        fromCol.total_cards = Math.max(0, (fromCol.total_cards ?? fromCol.cards.length + 1) - 1)
        const toCol = next[targetColIdx]!
        toCol.cards.unshift(updatedCard)
        toCol.total_cards = (toCol.total_cards ?? toCol.cards.length - 1) + 1
      } else {
        fromCol.cards[cardIdx] = updatedCard
      }

      this.columns = next
    },

    async atualizarConversa(
      workspaceId: number,
      conversaKey: string,
      patch: KanbanConversaPatch,
      extras?: { canal_nome?: string | null },
    ): Promise<KanbanConversaAtualizarResponse> {
      const key = conversaKey?.trim()
      if (!workspaceId || !key) {
        throw new Error('workspace_id e conversa_key são obrigatórios.')
      }

      const res = await $fetch<KanbanConversaAtualizarResponse>('/api/kanban/conversa', {
        method: 'PATCH',
        body: {
          workspace_id: workspaceId,
          conversa_key: key,
          patch,
        },
      })

      this.aplicarConversaAtualizadaNoCard(res, extras)

      return res
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

    /** Atualiza `entrega_status` de uma notificação I.A. no card do board (Pinia). */
    setNotificacaoIaEntregaStatus(
      conversaKey: string,
      notificacaoId: number,
      entregaStatus: string | null,
    ) {
      const key = conversaKey?.trim()
      if (!key || !Number.isFinite(notificacaoId) || notificacaoId < 1) return
      const status = normalizeEntregaStatus(entregaStatus)

      let changed = false
      const next = cloneColumns(this.columns)
      for (const col of next) {
        const idx = col.cards.findIndex((c) => c.conversa_key === key)
        if (idx === -1) continue

        const current = col.cards[idx]!
        const list = [...(current.notificacoes_ia ?? [])]
        const nIdx = list.findIndex((n) => n.id === notificacaoId)
        if (nIdx < 0) break

        list[nIdx] = {
          ...list[nIdx]!,
          entrega_status: status,
          updated_at: new Date().toISOString(),
        }
        col.cards[idx] = normalizeKanbanCard({
          ...current,
          notificacoes_ia: list,
        })
        changed = true
        break
      }
      if (changed) this.columns = next
    },

    /** Atualiza `token_entrega` de uma notificação I.A. no card do board (Pinia). */
    setNotificacaoIaTokenEntrega(
      conversaKey: string,
      notificacaoId: number,
      tokenEntrega: string | null,
    ) {
      const key = conversaKey?.trim()
      if (!key || !Number.isFinite(notificacaoId) || notificacaoId < 1) return
      const token =
        typeof tokenEntrega === 'string' && tokenEntrega.trim()
          ? tokenEntrega.trim().toLowerCase()
          : null

      let changed = false
      const next = cloneColumns(this.columns)
      for (const col of next) {
        const idx = col.cards.findIndex((c) => c.conversa_key === key)
        if (idx === -1) continue

        const current = col.cards[idx]!
        const list = [...(current.notificacoes_ia ?? [])]
        const nIdx = list.findIndex((n) => n.id === notificacaoId)
        if (nIdx < 0) break

        list[nIdx] = {
          ...list[nIdx]!,
          token_entrega: token,
          updated_at: new Date().toISOString(),
        }
        col.cards[idx] = normalizeKanbanCard({
          ...current,
          notificacoes_ia: list,
        })
        changed = true
        break
      }
      if (changed) this.columns = next
    },

    /** Remove uma notificação I.A. do card no board (Pinia). */
    removerNotificacaoIaDoCard(conversaKey: string, notificacaoId: number) {
      const key = conversaKey?.trim()
      if (!key || !Number.isFinite(notificacaoId) || notificacaoId < 1) return

      let changed = false
      const next = cloneColumns(this.columns)
      for (const col of next) {
        const idx = col.cards.findIndex((c) => c.conversa_key === key)
        if (idx === -1) continue

        const current = col.cards[idx]!
        const list = (current.notificacoes_ia ?? []).filter((n) => n.id !== notificacaoId)
        if (list.length === (current.notificacoes_ia ?? []).length) break

        col.cards[idx] = normalizeKanbanCard({
          ...current,
          notificacoes_ia: list,
        })
        changed = true
        break
      }
      if (changed) this.columns = next
    },

    /**
     * Reinsere uma notificação I.A. no card (rollback otimista).
     * Se o id já existir, substitui; senão adiciona no início da lista.
     */
    restaurarNotificacaoIaNoCard(
      conversaKey: string,
      notificacao: KanbanCard['notificacoes_ia'][number],
    ) {
      const key = conversaKey?.trim()
      if (!key || !notificacao || !Number.isFinite(notificacao.id) || notificacao.id < 1) return

      let changed = false
      const next = cloneColumns(this.columns)
      for (const col of next) {
        const idx = col.cards.findIndex((c) => c.conversa_key === key)
        if (idx === -1) continue

        const current = col.cards[idx]!
        const list = [...(current.notificacoes_ia ?? [])]
        const nIdx = list.findIndex((n) => n.id === notificacao.id)
        if (nIdx >= 0) {
          list[nIdx] = { ...notificacao }
        } else {
          list.unshift({ ...notificacao })
        }

        col.cards[idx] = normalizeKanbanCard({
          ...current,
          notificacoes_ia: list,
        })
        changed = true
        break
      }
      if (changed) this.columns = next
    },

    /** Adiciona notificação I.A. criada no card (Pinia). */
    adicionarNotificacaoIaNoCard(
      conversaKey: string,
      notificacao: KanbanCard['notificacoes_ia'][number],
    ) {
      this.restaurarNotificacaoIaNoCard(conversaKey, notificacao)
    },

    /**
     * POST /api/kanban/notificacoes_ia — cria pedido_pronto e injeta no Pinia.
     */
    async criarNotificacaoPedidoPronto(input: {
      workspaceId: number
      canalId: number
      conversaKey: string
      produtos: Array<{
        nome?: string
        nome_produto?: string
        qtd?: number
        quantidade?: number
        preco?: number
        preco_vista?: number | null
        preco_prazo?: number | null
      }>
      totalOrcamento?: { total_a_vista: number | null; total_a_prazo: number | null }
      formaPagamento: string
      observacoes?: string | null
      nome?: string | null
      fone?: string | null
    }) {
      const workspaceId = input.workspaceId
      const canalId = input.canalId
      const conversaKey = input.conversaKey?.trim()
      if (
        !Number.isFinite(workspaceId)
        || workspaceId < 1
        || !Number.isFinite(canalId)
        || canalId < 1
        || !conversaKey
      ) {
        throw new Error('Dados inválidos para criar o pedido.')
      }

      const res = await $fetch<{
        ok: true
        notificacao: KanbanCard['notificacoes_ia'][number]
      }>('/api/kanban/notificacoes_ia', {
        method: 'POST',
        body: {
          workspace_id: workspaceId,
          canal_id: canalId,
          conversa_key: conversaKey,
          produtos: input.produtos,
          total_orcamento: input.totalOrcamento
            ? normalizeTotalOrcamento(input.totalOrcamento)
            : undefined,
          forma_pagamento: input.formaPagamento,
          observacoes: input.observacoes ?? null,
          nome: input.nome ?? null,
          fone: input.fone ?? null,
        },
      })

      this.adicionarNotificacaoIaNoCard(conversaKey, res.notificacao)
      return res
    },

    /** PATCH /api/kanban/notificacoes_ia — atualiza `entrega_status`. */
    async patchNotificacaoIaEntregaStatus(input: {
      workspaceId: number
      conversaKey: string
      notificacaoId: number
      entregaStatus: string
    }) {
      const workspaceId = input.workspaceId
      const conversaKey = input.conversaKey?.trim()
      const notificacaoId = input.notificacaoId
      const entregaStatus = input.entregaStatus?.trim()
      if (
        !Number.isFinite(workspaceId)
        || workspaceId < 1
        || !conversaKey
        || !Number.isFinite(notificacaoId)
        || notificacaoId < 1
        || !entregaStatus
      ) {
        throw new Error('Dados inválidos para atualizar a notificação.')
      }

      return await $fetch<{
        ok: true
        id: number
        entrega_status: string
        updated_at: string
      }>('/api/kanban/notificacoes_ia', {
        method: 'PATCH',
        body: {
          workspace_id: workspaceId,
          id: notificacaoId,
          entrega_status: entregaStatus,
        },
      })
    },

    /** DELETE /api/kanban/notificacoes_ia — só persiste (Pinia fica a cargo do caller, otimista). */
    async deleteNotificacaoIa(input: {
      workspaceId: number
      conversaKey: string
      notificacaoId: number
    }) {
      const workspaceId = input.workspaceId
      const conversaKey = input.conversaKey?.trim()
      const notificacaoId = input.notificacaoId
      if (
        !Number.isFinite(workspaceId)
        || workspaceId < 1
        || !conversaKey
        || !Number.isFinite(notificacaoId)
        || notificacaoId < 1
      ) {
        throw new Error('Dados inválidos para excluir a notificação.')
      }

      await $fetch('/api/kanban/notificacoes_ia', {
        method: 'DELETE',
        body: {
          workspace_id: workspaceId,
          id: notificacaoId,
        },
      })

      return { ok: true as const, id: notificacaoId }
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

      const conversas = useConversasStore()
      let naoLidasAtual = 0
      for (const bucket of Object.values(conversas.byCanal)) {
        const item = bucket.items.find((c) => c.key === key)
        if (item) {
          naoLidasAtual = item.nao_lidas ?? 0
          break
        }
      }
      if (naoLidasAtual <= 0) return

      try {
        await $fetch('/api/conversas/marcar-lidas', {
          method: 'POST',
          body: { key },
        })
      } catch {
        return
      }

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
          // Nome editável não muda via Pusher.
          name: current.name,
        }

        if (msg.from_me === false && this.infoContatoConversaKey !== conversaKey) {
          merged.nao_lidas = (current.nao_lidas ?? 0) + 1
        }

        if (payload.is_group) {
          merged.is_group = true
          merged.photo = payload.conversa_photo ?? current.photo
          // Não altera `name` do card (editável) — só preview/nao_lidas/photo.
        } else {
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

    /** Abre o modal de notificações I.A. do card (toast / Pusher). */
    requestOpenNotificacoesIa(conversaKey: string) {
      const key = conversaKey?.trim()
      if (!key) return
      this.openNotificacoesConversaKey = key
    },

    clearOpenNotificacoesIaRequest() {
      this.openNotificacoesConversaKey = null
    },

    /**
     * Evento Pusher `kanban-atualizacao` (N8N): move card de coluna e/ou injeta pedido.
     */
    mergeFromPusherKanbanAtualizacao(payload: PusherKanbanAtualizacaoPayload) {
      const conversaKey = payload.conversa_key?.trim()
      if (!conversaKey) return

      const toColunaId =
        payload.coluna_id != null && Number.isFinite(Number(payload.coluna_id))
          ? Number(payload.coluna_id)
          : null

      let changed = false
      const next = cloneColumns(this.columns)

      let fromColIdx = -1
      let cardIdx = -1
      for (let ci = 0; ci < next.length; ci++) {
        const idx = next[ci]!.cards.findIndex((c) => c.conversa_key === conversaKey)
        if (idx !== -1) {
          fromColIdx = ci
          cardIdx = idx
          break
        }
      }

      if (fromColIdx >= 0 && cardIdx >= 0) {
        const fromCol = next[fromColIdx]!
        let card = { ...fromCol.cards[cardIdx]! }

        if (payload.notificacao && Number.isFinite(payload.notificacao.id)) {
          const notifNorm = {
            ...payload.notificacao,
            produtos: normalizeProdutosRaw(payload.notificacao.produtos),
            total_orcamento: normalizeTotalOrcamento(
              payload.notificacao.total_orcamento,
            ),
            entrega_status: normalizeEntregaStatus(payload.notificacao.entrega_status),
            id_cobranca:
              typeof payload.notificacao.id_cobranca === 'string' &&
              payload.notificacao.id_cobranca.trim()
                ? payload.notificacao.id_cobranca.trim()
                : payload.notificacao.id_cobranca ?? null,
            pagamento_realizado: payload.notificacao.pagamento_realizado === true,
            endereco:
              typeof payload.notificacao.endereco === 'string' &&
              payload.notificacao.endereco.trim()
                ? payload.notificacao.endereco.trim()
                : payload.notificacao.endereco ?? null,
            token_entrega:
              typeof payload.notificacao.token_entrega === 'string' &&
              payload.notificacao.token_entrega.trim()
                ? payload.notificacao.token_entrega.trim().toLowerCase()
                : payload.notificacao.token_entrega ?? null,
          }
          const list = [...(card.notificacoes_ia ?? [])]
          const nIdx = list.findIndex((n) => n.id === notifNorm.id)
          if (nIdx >= 0) list[nIdx] = notifNorm
          else list.unshift(notifNorm)
          card = { ...card, notificacoes_ia: list }
        } else if (
          payload.notificacao_id != null
          && Number.isFinite(Number(payload.notificacao_id))
          && payload.notificacao_entrega_status != null
          && String(payload.notificacao_entrega_status).trim()
        ) {
          const nid = Number(payload.notificacao_id)
          const list = [...(card.notificacoes_ia ?? [])]
          const nIdx = list.findIndex((n) => n.id === nid)
          if (nIdx >= 0) {
            list[nIdx] = {
              ...list[nIdx]!,
              entrega_status: normalizeEntregaStatus(payload.notificacao_entrega_status),
              updated_at: new Date().toISOString(),
            }
            card = { ...card, notificacoes_ia: list }
          }
        }

        if (toColunaId != null && toColunaId !== fromCol.id) {
          const toCol = next.find((c) => c.id === toColunaId)
          if (toCol) {
            fromCol.cards.splice(cardIdx, 1)
            card.coluna_id = toColunaId
            toCol.cards.unshift(normalizeKanbanCard(card))
            fromCol.total_cards = Math.max(0, (fromCol.total_cards ?? fromCol.cards.length + 1) - 1)
            toCol.total_cards = (toCol.total_cards ?? toCol.cards.length - 1) + 1
            changed = true
          } else {
            fromCol.cards[cardIdx] = normalizeKanbanCard({ ...card, coluna_id: toColunaId })
            changed = true
          }
        } else {
          fromCol.cards[cardIdx] = normalizeKanbanCard(card)
          changed = true
        }
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
      let cardMovido: KanbanCard | null = null
      let moveuOk = false
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
        cardMovido = card
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
        moveuOk = true
      } catch (err: unknown) {
        if (snapshot) this.columns = snapshot
        const msg = mensagemErroFetch(err, 'Não foi possível mover o card.')
        toast.error(msg, { duration: 8000 })
      } finally {
        delete this.movingKeys[conversaKey]
      }

      if (moveuOk) {
        await this.dispararAgendamentoDaColunaSeHouver({
          workspaceId,
          colunaId: toId,
          conversaKey,
          card: cardMovido,
        })
      }
    },

    /**
     * Se a coluna destino tiver `id_agendamento_mensagem`, dispara o webhook N8N
     * da mensagem pronta. Sem valor na coluna, não faz nada.
     */
    async dispararAgendamentoDaColunaSeHouver(input: {
      workspaceId: number
      colunaId: number
      conversaKey: string
      card?: KanbanCard | null
      exibirToast?: boolean
    }): Promise<boolean> {
      const coluna = this.columns.find((c) => c.id === input.colunaId)
      const sequenciaId = coluna?.id_agendamento_mensagem?.trim() || ''
      if (!sequenciaId) return false

      const key = input.conversaKey.trim()
      const card =
        input.card
        ?? this.columns.flatMap((c) => c.cards).find((c) => c.conversa_key === key)
        ?? null
      if (!card) {
        toast.error('Não foi possível enviar a mensagem automática: conversa não encontrada.')
        return false
      }

      const canalId = card.id_canal
      if (canalId == null || canalId < 1) {
        toast.error('Não foi possível enviar a mensagem automática: canal não identificado.')
        return false
      }

      const phone = card.phone?.trim() || card.lid?.trim() || null
      const name = card.name?.trim() || card.name_group?.trim() || null
      const prontas = useMensagensProntasStore()

      try {
        await prontas.dispararWebhookN8n({
          workspaceId: input.workspaceId,
          canalId,
          conversaKey: key,
          phone,
          name,
          sequenciaId,
        })
        if (input.exibirToast !== false) {
          toast.success('Mensagem automática enviada.')
        }
        return true
      } catch (err: unknown) {
        toast.error(mensagemErroFetch(err, 'Não foi possível enviar a mensagem automática.'))
        return false
      }
    },

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
        await this.refetchCurrentBoard(payload.workspaceId)
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
      id_agendamento_mensagem?: string | null
    }): Promise<boolean> {
      if (!payload.workspaceId || !payload.colunaId) return false
      try {
        const body: Record<string, unknown> = {
          workspace_id: payload.workspaceId,
          coluna_id: payload.colunaId,
          nome: payload.nome.trim(),
          cor: payload.cor?.trim() || null,
        }
        if (payload.id_agendamento_mensagem !== undefined) {
          body.id_agendamento_mensagem = payload.id_agendamento_mensagem
        }
        await $fetch('/api/kanban/coluna', {
          method: 'PATCH',
          body,
        })
        await this.refetchCurrentBoard(payload.workspaceId)
        return true
      } catch (err: unknown) {
        const msg = mensagemErroFetch(err, 'Não foi possível atualizar a coluna.')
        toast.error(msg, { duration: 8000 })
        return false
      }
    },

    /** Atualiza só o vínculo de agendamento automático da coluna (sem alterar nome/cor). */
    async vincularAgendamentoColuna(payload: {
      workspaceId: number
      colunaId: number
      nome: string
      cor: string | null
      id_agendamento_mensagem: string | null
    }): Promise<boolean> {
      return this.updateColumn({
        workspaceId: payload.workspaceId,
        colunaId: payload.colunaId,
        nome: payload.nome,
        cor: payload.cor,
        id_agendamento_mensagem: payload.id_agendamento_mensagem,
      })
    },

    /** Recolhe / expande coluna no board (persistido em `funil_workspace_colunas.recolhida`). */
    async setColunaRecolhida(payload: {
      workspaceId: number
      colunaId: number
      recolhida: boolean
    }): Promise<boolean> {
      if (!payload.workspaceId || !payload.colunaId) return false
      const col = this.columns.find((c) => c.id === payload.colunaId)
      if (!col) return false

      const prev = col.recolhida === true
      const next = payload.recolhida === true
      if (prev === next) return true

      col.recolhida = next
      try {
        await $fetch('/api/kanban/coluna', {
          method: 'PATCH',
          body: {
            workspace_id: payload.workspaceId,
            coluna_id: payload.colunaId,
            recolhida: next,
          },
        })
        return true
      } catch (err: unknown) {
        col.recolhida = prev
        const msg = mensagemErroFetch(err, 'Não foi possível recolher/expandir a coluna.')
        toast.error(msg, { duration: 8000 })
        return false
      }
    },

    async toggleColunaRecolhida(payload: {
      workspaceId: number
      colunaId: number
    }): Promise<boolean> {
      const col = this.columns.find((c) => c.id === payload.colunaId)
      if (!col) return false
      return this.setColunaRecolhida({
        workspaceId: payload.workspaceId,
        colunaId: payload.colunaId,
        recolhida: !(col.recolhida === true),
      })
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
        await this.refetchCurrentBoard(payload.workspaceId)
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
        await this.refetchCurrentBoard(payload.workspaceId)
        toast.success('Coluna excluída.')
        return true
      } catch (err: unknown) {
        const msg = mensagemErroFetch(err, 'Não foi possível excluir a coluna.')
        toast.error(msg, { duration: 8000 })
        return false
      }
    },

    /**
     * Remove conversa do board e do banco (`POST /api/conversas/deletar`).
     */
    async deleteCard(conversaKey: string): Promise<boolean> {
      const key = conversaKey.trim()
      if (!key) return false

      try {
        await $fetch('/api/conversas/deletar', {
          method: 'POST',
          body: { key },
        })

        const next = cloneColumns(this.columns)
        for (const col of next) {
          const idx = col.cards.findIndex((c) => c.conversa_key === key)
          if (idx === -1) continue
          col.cards.splice(idx, 1)
          col.total_cards = Math.max(0, (col.total_cards ?? col.cards.length + 1) - 1)
        }
        this.columns = next

        if (this.infoContatoConversaKey === key) {
          this.infoContatoConversaKey = null
        }

        useConversasStore().removeConversaByDbKey(key)
        useMensagensStore().afterConversaDeleted(key)

        toast.success('Conversa excluída permanentemente.')
        return true
      } catch (err: unknown) {
        const msg = mensagemErroFetch(err, 'Não foi possível excluir a conversa.')
        toast.error(msg, { duration: 8000 })
        return false
      }
    },

    reset() {
      this.funilId = null
      this.funilNome = ''
      this.funis = []
      this.funisPending = false
      this.funisError = null
      this.funisWorkspaceIdLoaded = null
      this.columns = []
      this.pending = false
      this.error = null
      this.loadedAt = null
      this.workspaceIdLoaded = null
      this.funilIdLoaded = null
      this.movingKeys = {}
      this.reorderingColumnId = null
      this.loadingMoreByColumn = {}
      this.infoContatoConversaKey = null
      this.busca = ''
    },
  },
})
