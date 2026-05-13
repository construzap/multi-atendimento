import { defineStore } from 'pinia'
import type {
  FreteBairroListaItem,
  FreteBairrosListaResponse,
  FreteConfigCapacidadeResumo,
  FreteConfigWorkspace,
} from '#shared/types/frete'
import { mensagemErroFetch } from '~/stores/canais'

type CapacidadeCache = Record<number, FreteConfigCapacidadeResumo | undefined>
type BairrosCache = Record<number, FreteBairroListaItem[] | undefined>

/**
 * Dedupe de GET em voo — **fora** do `state` do Pinia: `Promise` não é POJO e quebra o payload SSR (devalue).
 */
const fetchesCapacidadeEmCurso = new Map<number, Promise<boolean>>()

/**
 * Estado de frete por workspace (ex.: configuração de capacidade em cache).
 */
export const useFreteStore = defineStore('frete', {
  state: () => ({
    /** `undefined` = ainda não buscado; objeto = já buscado (pode ser sem linha no banco). */
    capacidadePorWorkspace: {} as CapacidadeCache,
    capacidadeFetchPending: {} as Record<number, boolean>,
    capacidadeFetchError: null as string | null,

    /** `undefined` = ainda não buscado; array (possivelmente vazio) = já buscado. */
    bairrosPorWorkspace: {} as BairrosCache,
    bairrosFetchPending: {} as Record<number, boolean>,
    bairrosFetchError: null as string | null,
  }),

  getters: {
    capacidadeCarregando:
      (state) =>
      (workspaceId: number): boolean =>
        Boolean(state.capacidadeFetchPending[workspaceId]),
    bairrosCarregando:
      (state) =>
      (workspaceId: number): boolean =>
        Boolean(state.bairrosFetchPending[workspaceId]),
  },

  actions: {
    /**
     * Se já existir no cache para o workspace, não chama a API.
     * Caso contrário, GET /api/frete/config e grava em `capacidadePorWorkspace`.
     */
    async fetchCapacidadeSeNecessario(workspaceId: number): Promise<boolean> {
      if (!Number.isFinite(workspaceId) || workspaceId < 1) {
        return false
      }
      if (this.capacidadePorWorkspace[workspaceId] !== undefined) {
        return true
      }
      const emCurso = fetchesCapacidadeEmCurso.get(workspaceId)
      if (emCurso) {
        return emCurso
      }

      const promise = (async (): Promise<boolean> => {
        this.capacidadeFetchPending[workspaceId] = true
        this.capacidadeFetchError = null

        try {
          const res = await $fetch<FreteConfigCapacidadeResumo>('/api/frete/config', {
            method: 'GET',
            query: { workspace_id: workspaceId },
          })
          this.capacidadePorWorkspace[workspaceId] = {
            id: res.id,
            capacidade_caminhao_kg: res.capacidade_caminhao_kg,
          }
          return true
        } catch (err) {
          this.capacidadeFetchError = mensagemErroFetch(err, 'Não foi possível carregar a capacidade do caminhão.')
          return false
        } finally {
          this.capacidadeFetchPending[workspaceId] = false
        }
      })()

      fetchesCapacidadeEmCurso.set(workspaceId, promise)
      try {
        return await promise
      } finally {
        fetchesCapacidadeEmCurso.delete(workspaceId)
      }
    },

    /** Após POST salvar — atualiza o cache sem novo GET. */
    aplicarCapacidadeSalva(
      workspaceId: number,
      row: Pick<FreteConfigWorkspace, 'id' | 'capacidade_caminhao_kg'>,
    ) {
      if (!Number.isFinite(workspaceId) || workspaceId < 1) return
      this.capacidadePorWorkspace[workspaceId] = {
        id: row.id,
        capacidade_caminhao_kg: row.capacidade_caminhao_kg,
      }
    },

    /** Remove cache de um workspace (ex.: troca de contexto forçada). */
    invalidarCapacidade(workspaceId: number) {
      if (!Number.isFinite(workspaceId) || workspaceId < 1) return
      fetchesCapacidadeEmCurso.delete(workspaceId)
      const next = { ...this.capacidadePorWorkspace } as CapacidadeCache
      delete next[workspaceId]
      this.capacidadePorWorkspace = next
    },

    limparErroCapacidade() {
      this.capacidadeFetchError = null
    },

    /**
     * GET /api/frete/bairros — lista todos os bairros ativos no cache (até o limite da API).
     * Com `forcar`, ignora cache e busca de novo (ex.: após cadastrar ou editar).
     */
    async fetchBairrosRecentes(workspaceId: number, forcar = false): Promise<boolean> {
      if (!Number.isFinite(workspaceId) || workspaceId < 1) {
        return false
      }
      if (!forcar && this.bairrosPorWorkspace[workspaceId] !== undefined) {
        return true
      }

      this.bairrosFetchPending[workspaceId] = true
      this.bairrosFetchError = null

      try {
        const res = await $fetch<FreteBairrosListaResponse>('/api/frete/bairros', {
          method: 'GET',
          query: { workspace_id: workspaceId, limit: 5000 },
        })
        this.bairrosPorWorkspace[workspaceId] = res.data ?? []
        return true
      } catch (err) {
        this.bairrosFetchError = mensagemErroFetch(err, 'Não foi possível carregar os fretes por bairro.')
        return false
      } finally {
        this.bairrosFetchPending[workspaceId] = false
      }
    },

    async recarregarBairrosRecentes(workspaceId: number): Promise<boolean> {
      return this.fetchBairrosRecentes(workspaceId, true)
    },

    invalidarBairros(workspaceId: number) {
      if (!Number.isFinite(workspaceId) || workspaceId < 1) return
      const next = { ...this.bairrosPorWorkspace } as BairrosCache
      delete next[workspaceId]
      this.bairrosPorWorkspace = next
    },

    limparErroBairros() {
      this.bairrosFetchError = null
    },
  },
})
