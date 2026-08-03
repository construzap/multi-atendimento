import { defineStore } from 'pinia'
import type {
  AdminCustosIaErroResponse,
  AdminCustosIaResponse,
  CustoPorCanalRow,
  CustoTokenIaErroRow,
} from '#shared/types/adminCustosIa'
import { mensagemErroFetch } from '~/stores/canais'

export type AdminCustosIaModo = 'custos' | 'erros'

export const useAdminCustosIaStore = defineStore('admin-custos-ia', {
  state: () => ({
    modo: 'custos' as AdminCustosIaModo,
    items: [] as CustoPorCanalRow[],
    erros: [] as CustoTokenIaErroRow[],
    pending: false,
    loaded: false,
    errosLoaded: false,
    error: null as string | null,
  }),

  getters: {
    totalCustoBrl(state): number {
      return state.items.reduce((acc, row) => acc + row.custo_total_brl, 0)
    },

    totalTokens(state): number {
      return state.items.reduce((acc, row) => acc + row.total_tokens_usados, 0)
    },
  },

  actions: {
    clear() {
      this.modo = 'custos'
      this.items = []
      this.erros = []
      this.pending = false
      this.loaded = false
      this.errosLoaded = false
      this.error = null
    },

    async setModo(modo: AdminCustosIaModo) {
      if (this.modo === modo) return
      this.modo = modo
      this.error = null
      if (modo === 'custos') {
        await this.fetchCustos({ force: false })
      } else {
        await this.fetchErros({ force: false })
      }
    },

    async fetchCustos({ force = false } = {}) {
      if (!force && this.loaded && !this.error) return

      this.pending = true
      this.error = null

      try {
        const res = await $fetch<AdminCustosIaResponse>('/api/admin/custos-da-ia', {
          method: 'GET',
        })
        this.items = res.items ?? []
        this.loaded = true
      } catch (err) {
        this.error = mensagemErroFetch(err, 'Não foi possível carregar os custos da I.A.')
        this.loaded = true
        throw err
      } finally {
        this.pending = false
      }
    },

    async fetchErros({ force = false } = {}) {
      if (!force && this.errosLoaded && !this.error) return

      this.pending = true
      this.error = null

      try {
        const res = await $fetch<AdminCustosIaErroResponse>('/api/admin/custos-da-ia/erro', {
          method: 'GET',
        })
        this.erros = res.items ?? []
        this.errosLoaded = true
      } catch (err) {
        this.error = mensagemErroFetch(err, 'Não foi possível carregar os erros da I.A.')
        this.errosLoaded = true
        throw err
      } finally {
        this.pending = false
      }
    },

    async fetchModoAtual({ force = false } = {}) {
      if (this.modo === 'erros') {
        return this.fetchErros({ force })
      }
      return this.fetchCustos({ force })
    },

    async fetchCustosSeNecessario() {
      return this.fetchCustos({ force: false })
    },
  },
})
