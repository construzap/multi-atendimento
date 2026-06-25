import { defineStore } from 'pinia'
import type {
  CampoContatoSistema,
  Contato,
  ContatoAtualizarResponse,
  ContatoPatch,
  ContatosListResponse,
} from '#shared/types/contato'
import { mensagemErroFetch } from '~/stores/canais'
import type { CampoMapeamentoColuna } from '~/utils/mapeamentoColunasImportacao'

type ContatoCampoId = keyof Omit<Contato, 'key'>

const CAMPOS_IGNORADOS = new Set(['key', 'campos_personalizados', 'status_funil'])

/** Não aparecem no modal de mapeamento; valores definidos na importação. */
const CAMPOS_OCULTOS_MAPEAMENTO = new Set<string>([
  'connect_phone',
  'updated_at',
  'workspace_id',
  'is_group',
  'nao_lidas',
  'lid',
  'photo',
  'name_group',
  'latitude',
  'longitude',
])

const ORDEM_CAMPOS: ContatoCampoId[] = [
  'name',
  'phone',
  'lid',
  'connect_phone',
  'photo',
  'id_canal',
  'workspace_id',
  'created_at',
  'updated_at',
  'conversa_aberta',
  'is_group',
  'name_group',
  'ia_ligada',
  'nao_lidas',
  'latitude',
  'longitude',
]

const CAMPOS_META: Record<ContatoCampoId, { label: string; obrigatorio?: boolean }> = {
  name: { label: 'Nome', obrigatorio: true },
  phone: { label: 'Telefone', obrigatorio: true },
  lid: { label: 'LID' },
  connect_phone: { label: 'Telefone conectado' },
  photo: { label: 'URL da foto' },
  id_canal: { label: 'ID do canal', obrigatorio: true },
  workspace_id: { label: 'ID do workspace' },
  created_at: { label: 'Criado em' },
  updated_at: { label: 'Atualizado em' },
  conversa_aberta: { label: 'Conversa aberta' },
  is_group: { label: 'Grupo' },
  name_group: { label: 'Nome do grupo' },
  ia_ligada: { label: 'I.A. ligada' },
  nao_lidas: { label: 'Não lidas' },
  latitude: { label: 'Latitude' },
  longitude: { label: 'Longitude' },
}

function chavesDosItens(items: Contato[]): Set<string> {
  const keys = new Set<string>()
  for (const item of items) {
    for (const k of Object.keys(item)) {
      if (!CAMPOS_IGNORADOS.has(k)) keys.add(k)
    }
  }
  return keys
}

function ordenarChaves(keys: Set<string>): string[] {
  const ordered: string[] = []
  for (const k of ORDEM_CAMPOS) {
    if (keys.has(k)) ordered.push(k)
  }
  for (const k of keys) {
    if (!ordered.includes(k)) ordered.push(k)
  }
  return ordered
}

function montarCamposSistema(items: Contato[]): CampoContatoSistema[] {
  const keys = chavesDosItens(items)

  if (keys.size === 0) {
    return ORDEM_CAMPOS.map((id) => ({
      id,
      label: CAMPOS_META[id].label,
      obrigatorio: CAMPOS_META[id].obrigatorio,
    }))
  }

  return ordenarChaves(keys).map((id) => {
    const meta = CAMPOS_META[id as ContatoCampoId]
    return {
      id,
      label: meta?.label ?? id,
      obrigatorio: meta?.obrigatorio,
    }
  })
}

function filtrarCamposMapeamento(campos: CampoContatoSistema[]): CampoContatoSistema[] {
  return campos.filter((c) => !CAMPOS_OCULTOS_MAPEAMENTO.has(String(c.id)))
}

type ContatosSlice = {
  items: Contato[]
  total: number
  page: number
  perPage: number
}

type ContatosCacheEntry = ContatosSlice & {
  loadedAt: number
}

type ContatosState = {
  workspaceId: number | null
  /** Lista principal (sem busca ativa na tela). */
  lista: ContatosSlice
  /** Resultados da busca — não altera `lista`. */
  busca: ContatosSlice & { q: string }
  pending: boolean
  loadingMore: boolean
  error: string | null
  cacheLista: Record<number, ContatosCacheEntry>
  cacheBusca: Record<string, ContatosCacheEntry>
}

type FetchContatosOptions = {
  append?: boolean
  q?: string
  force?: boolean
}

function emptySlice(): ContatosSlice {
  return { items: [], total: 0, page: 1, perPage: 20 }
}

function buscaCacheKey(workspaceId: number, q: string): string {
  return `${workspaceId}:${q}`
}

function sliceFromEntry(entry: ContatosCacheEntry): ContatosSlice {
  return {
    items: [...entry.items],
    total: entry.total,
    page: entry.page,
    perPage: entry.perPage,
  }
}

export const useContatosStore = defineStore('contatos', {
  state: (): ContatosState => ({
    workspaceId: null,
    lista: emptySlice(),
    busca: { ...emptySlice(), q: '' },
    pending: false,
    loadingMore: false,
    error: null,
    cacheLista: {},
    cacheBusca: {},
  }),

  getters: {
    /** Termo de busca aplicado (vazio = exibindo lista principal). */
    q(state): string {
      return state.busca.q
    },
    emModoBusca(state): boolean {
      return state.busca.q.length > 0
    },
    items(state): Contato[] {
      return state.busca.q.length > 0 ? state.busca.items : state.lista.items
    },
    total(state): number {
      return state.busca.q.length > 0 ? state.busca.total : state.lista.total
    },
    hasMore(state): boolean {
      const slice = state.busca.q.length > 0 ? state.busca : state.lista
      return slice.items.length < slice.total
    },
    /**
     * Campos do sistema derivados das chaves dos itens já carregados (`lista` + `busca`).
     * Atualiza automaticamente quando novos contatos entram no Pinia.
     */
    camposSistema(state): CampoContatoSistema[] {
      const items = [...state.lista.items, ...state.busca.items]
      return montarCamposSistema(items)
    },
    /** Campos passados ao modal de mapeamento (`id` + `label`). */
    camposMapeamento(): CampoMapeamentoColuna[] {
      return filtrarCamposMapeamento(this.camposSistema).map(({ id, label }) => ({ id, label }))
    },
    camposObrigatoriosImportacao(): string[] {
      return filtrarCamposMapeamento(this.camposSistema)
        .filter((c) => c.obrigatorio)
        .map((c) => c.id)
    },
  },

  actions: {
    _sliceAtivo(isBusca: boolean): ContatosSlice {
      return isBusca ? this.busca : this.lista
    },

    _aplicarSlice(isBusca: boolean, slice: ContatosSlice) {
      if (isBusca) {
        this.busca.items = [...slice.items]
        this.busca.total = slice.total
        this.busca.page = slice.page
        this.busca.perPage = slice.perPage
      } else {
        this.lista.items = [...slice.items]
        this.lista.total = slice.total
        this.lista.page = slice.page
        this.lista.perPage = slice.perPage
      }
    },

    _salvarCache(workspaceId: number, isBusca: boolean, q: string) {
      const slice = this._sliceAtivo(isBusca)
      const entry: ContatosCacheEntry = {
        items: [...slice.items],
        total: slice.total,
        page: slice.page,
        perPage: slice.perPage,
        loadedAt: Date.now(),
      }
      if (isBusca) {
        this.cacheBusca[buscaCacheKey(workspaceId, q)] = entry
      } else {
        this.cacheLista[workspaceId] = entry
      }
    },

    limparBusca() {
      this.busca.q = ''
      this.busca.items = []
      this.busca.total = 0
      this.busca.page = 1
      this.busca.perPage = 20
      this.error = null
    },

    _substituirContatoNasListas(contato: Contato) {
      const atualizar = (items: Contato[]) => {
        const idx = items.findIndex((c) => c.key === contato.key)
        if (idx < 0) return items
        const next = [...items]
        next[idx] = contato
        return next
      }

      this.lista.items = atualizar(this.lista.items)
      if (this.busca.q.length > 0) {
        this.busca.items = atualizar(this.busca.items)
      }

      const wid = this.workspaceId
      if (wid != null) {
        if (this.cacheLista[wid]) {
          this.cacheLista[wid] = {
            ...this.cacheLista[wid],
            items: atualizar(this.cacheLista[wid].items),
          }
        }
        if (this.busca.q.length > 0) {
          const ck = buscaCacheKey(wid, this.busca.q)
          if (this.cacheBusca[ck]) {
            this.cacheBusca[ck] = {
              ...this.cacheBusca[ck],
              items: atualizar(this.cacheBusca[ck].items),
            }
          }
        }
      }
    },

    async atualizarContato(workspaceId: number, key: string, patch: ContatoPatch): Promise<Contato> {
      const res = await $fetch<ContatoAtualizarResponse>('/api/contatos/atualizar', {
        method: 'PATCH',
        body: { workspace_id: workspaceId, key, patch },
      })

      const contato = res.data
      this._substituirContatoNasListas(contato)
      return contato
    },

    reset() {
      this.workspaceId = null
      this.lista = emptySlice()
      this.busca = { ...emptySlice(), q: '' }
      this.pending = false
      this.loadingMore = false
      this.error = null
      this.cacheLista = {}
      this.cacheBusca = {}
    },

    async fetchPagina(workspaceId: number, options: FetchContatosOptions = {}) {
      const append = options.append === true
      const force = options.force === true
      const q = (options.q ?? (append ? this.busca.q : '')).trim()
      const isBusca = q.length > 0

      this.workspaceId = workspaceId

      if (!isBusca && !append) {
        this.limparBusca()
      }

      if (isBusca) {
        this.busca.q = q
      }

      const slice = this._sliceAtivo(isBusca)
      const nextPage = append ? slice.page + 1 : 1

      const cached = isBusca
        ? this.cacheBusca[buscaCacheKey(workspaceId, q)]
        : this.cacheLista[workspaceId]

      if (!force) {
        if (!append && cached && cached.items.length > 0) {
          this._aplicarSlice(isBusca, sliceFromEntry(cached))
          this.error = null
          return
        }

        if (
          append &&
          cached &&
          cached.page >= nextPage &&
          cached.items.length >= nextPage * cached.perPage
        ) {
          this._aplicarSlice(isBusca, sliceFromEntry(cached))
          this.error = null
          return
        }
      }

      const sliceAtual = this._sliceAtivo(isBusca)
      if (append && sliceAtual.items.length >= sliceAtual.total && sliceAtual.total > 0) return
      if (append && (this.loadingMore || this.pending)) return

      if (append) {
        this.loadingMore = true
      } else {
        this.pending = true
        this.error = null
      }

      try {
        const res = await $fetch<ContatosListResponse>('/api/contatos', {
          method: 'GET',
          query: {
            workspace_id: workspaceId,
            page: nextPage,
            q: q || undefined,
          },
        })

        const novos = res.data ?? []
        const atual = this._sliceAtivo(isBusca)
        const items = append ? [...atual.items, ...novos] : novos

        this._aplicarSlice(isBusca, {
          items,
          total: res.total,
          page: res.page,
          perPage: res.perPage,
        })
        this._salvarCache(workspaceId, isBusca, q)
      } catch (err: unknown) {
        const msg = mensagemErroFetch(err, 'Não foi possível carregar os contatos.')
        if (!append) {
          this.error = msg
          this._aplicarSlice(isBusca, emptySlice())
          if (isBusca) {
            this.busca.q = q
          }
        }
        throw err
      } finally {
        if (append) {
          this.loadingMore = false
        } else {
          this.pending = false
        }
      }
    },
  },
})
