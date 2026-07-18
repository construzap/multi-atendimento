import { defineStore } from 'pinia'
import type {
  Cobranca,
  CobrancaProduto,
  ListarCobrancaProdutosResponse,
  ListarCobrancasResponse,
} from '#shared/types/cobranca'
import { mensagemErroFetch } from '~/stores/canais'

type CobrancaState = {
  items: Cobranca[]
  /** Workspace cuja lista está em `items` (cache). */
  workspaceIdLoaded: number | null
  pending: boolean
  error: string | null
  produtosPending: boolean
  produtosError: string | null
}

function semProdutosNoPayload(cobranca: Cobranca): Cobranca {
  const { produtos: _p, ...rest } = cobranca
  return rest as Cobranca
}

export const useCobrancaStore = defineStore('cobranca', {
  state: (): CobrancaState => ({
    items: [],
    workspaceIdLoaded: null,
    pending: false,
    error: null,
    produtosPending: false,
    produtosError: null,
  }),

  getters: {
    total(state): number {
      return state.items.length
    },
  },

  actions: {
    async fetchCobrancas(workspaceId: number) {
      if (!workspaceId) return []

      this.pending = true
      this.error = null
      try {
        const resposta = await $fetch<ListarCobrancasResponse>('/api/cobranca', {
          method: 'GET',
          query: { workspace_id: workspaceId },
        })
        const anteriores = this.items
        // Preserva `produtos` já carregados por cobrança (listagem não traz produtos).
        this.items = (resposta.data ?? []).map((row) => {
          const antigo = anteriores.find((c) => c.id === row.id)
          if (antigo?.produtos != null) {
            return { ...row, produtos: antigo.produtos }
          }
          return { ...row }
        })
        this.workspaceIdLoaded = workspaceId
        return this.items
      } catch (err) {
        this.items = []
        this.workspaceIdLoaded = null
        this.error = mensagemErroFetch(err, 'Não foi possível carregar as cobranças.')
        throw err
      } finally {
        this.pending = false
      }
    },

    /** Cache-first: se já carregou este workspace, não chama a API. */
    async ensureCobrancasLoaded(workspaceId: number, options?: { force?: boolean }) {
      if (!workspaceId) return
      if (!options?.force && this.workspaceIdLoaded === workspaceId) return
      await this.fetchCobrancas(workspaceId)
    },

    getById(id: number): Cobranca | null {
      return this.items.find((c) => c.id === id) ?? null
    },

    /**
     * Cache-first: se a cobrança já tem `produtos` no Pinia, não chama a API.
     * Caso contrário busca e grava em `items[].produtos`.
     */
    async ensureProdutosLoaded(
      cobrancaId: number,
      workspaceId: number,
      options?: { force?: boolean },
    ): Promise<CobrancaProduto[]> {
      if (!cobrancaId || !workspaceId) return []

      const atual = this.getById(cobrancaId)
      if (!options?.force && atual?.produtos != null) {
        return atual.produtos
      }

      this.produtosPending = true
      this.produtosError = null
      try {
        const resposta = await $fetch<ListarCobrancaProdutosResponse>('/api/cobranca/produtos', {
          method: 'GET',
          query: { cobranca_id: cobrancaId, workspace_id: workspaceId },
        })
        const produtos = resposta.data ?? []
        this.setProdutosNaCobranca(cobrancaId, produtos)
        return produtos
      } catch (err) {
        this.produtosError = mensagemErroFetch(err, 'Não foi possível carregar os produtos.')
        throw err
      } finally {
        this.produtosPending = false
      }
    },

    setProdutosNaCobranca(cobrancaId: number, produtos: CobrancaProduto[]) {
      const idx = this.items.findIndex((c) => c.id === cobrancaId)
      if (idx < 0) return
      const next = [...this.items]
      next[idx] = { ...next[idx]!, produtos }
      this.items = next
      this.produtosError = null
    },

    /** Inclui cobrança recém-criada no topo da lista (sem refetch). */
    addCobranca(cobranca: Cobranca, workspaceId: number) {
      const produtos = cobranca.produtos
      const item: Cobranca =
        produtos != null
          ? { ...semProdutosNoPayload(cobranca), produtos }
          : semProdutosNoPayload(cobranca)

      if (this.workspaceIdLoaded !== workspaceId) {
        this.items = [item]
        this.workspaceIdLoaded = workspaceId
        this.error = null
        return
      }
      const semDuplicata = this.items.filter((c) => c.id !== item.id)
      this.items = [item, ...semDuplicata]
    },

    /** Atualiza cobrança existente; preserva produtos se o payload não trouxer. */
    updateCobranca(cobranca: Cobranca) {
      const idx = this.items.findIndex((c) => c.id === cobranca.id)
      const existentes = idx >= 0 ? this.items[idx]?.produtos : undefined
      const produtos = cobranca.produtos ?? existentes
      const item: Cobranca =
        produtos != null
          ? { ...semProdutosNoPayload(cobranca), produtos }
          : semProdutosNoPayload(cobranca)

      if (idx < 0) {
        this.items = [item, ...this.items]
        return
      }
      const next = [...this.items]
      next[idx] = item
      this.items = next
    },

    clear() {
      this.items = []
      this.workspaceIdLoaded = null
      this.pending = false
      this.error = null
      this.produtosPending = false
      this.produtosError = null
    },
  },
})
