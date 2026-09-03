import { defineStore } from 'pinia'
import type {
  AdminCustosIaErroResponse,
  AdminCustosIaPorCanalResponse,
  AdminCustosIaPorCanalTotais,
  AdminCustosIaResponse,
  CustoPorCanalRow,
  CustoTokenIaErroRow,
} from '#shared/types/adminCustosIa'
import { CUSTO_IA_SEM_CANAL_SLUG } from '#shared/types/adminCustosIa'
import { mensagemErroFetch } from '~/stores/canais'

export type AdminCustosIaModo = 'custos' | 'erros'

const TOTAIS_ZERADOS: AdminCustosIaPorCanalTotais = {
  custo_brl: 0,
  total_tokens: 0,
  total_palavras: 0,
  total_letras: 0,
  total_mensagens: 0,
  custo_por_letra: 0,
  custo_por_mensagem: 0,
}

export function custoIaCanalParam(canalId: number | null): string {
  return canalId == null ? CUSTO_IA_SEM_CANAL_SLUG : String(canalId)
}

export function parseCustoIaCanalParam(raw: unknown): number | null | undefined {
  const s = String(raw ?? '').trim()
  if (!s || s === CUSTO_IA_SEM_CANAL_SLUG || s === 'null') return null
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return undefined
  return n
}

function detalheKey(
  canalId: number | null,
  dataInicio: string | null,
  dataFinal: string | null,
): string {
  return `${canalId ?? 'null'}:${dataInicio ?? ''}:${dataFinal ?? ''}`
}

export const useAdminCustosIaStore = defineStore('admin-custos-ia', {
  state: () => ({
    modo: 'custos' as AdminCustosIaModo,
    items: [] as CustoPorCanalRow[],
    erros: [] as CustoTokenIaErroRow[],
    pending: false,
    loaded: false,
    errosLoaded: false,
    error: null as string | null,

    detalheWorkspaceId: null as number | null,
    detalheCanalId: null as number | null,
    detalheDataInicio: null as string | null,
    detalheDataFinal: null as string | null,
    detalheWorkspaceNome: null as string | null,
    detalheNomeCanal: '' as string,
    detalheTotais: { ...TOTAIS_ZERADOS } as AdminCustosIaPorCanalTotais,
    detalhePending: false,
    detalheLoaded: false,
    detalheError: null as string | null,
    detalheLoadedKey: '' as string,
  }),

  getters: {
    totalCustoBrl(state): number {
      return state.items.reduce((acc, row) => acc + row.custo_total_brl, 0)
    },

    totalTokens(state): number {
      return state.items.reduce((acc, row) => acc + row.total_tokens_usados, 0)
    },

    totalPalavras(state): number {
      return state.items.reduce((acc, row) => acc + row.total_palavras, 0)
    },

    totalLetras(state): number {
      return state.items.reduce((acc, row) => acc + row.total_letras, 0)
    },

    totalMensagens(state): number {
      return state.items.reduce((acc, row) => acc + row.total_mensagens, 0)
    },

    custoPorLetraLista(state): number {
      const letras = state.items.reduce((acc, row) => acc + row.total_letras, 0)
      const custo = state.items.reduce((acc, row) => acc + row.custo_total_brl, 0)
      return letras > 0 ? custo / letras : 0
    },

    custoPorMensagemLista(state): number {
      const mensagens = state.items.reduce((acc, row) => acc + row.total_mensagens, 0)
      const custo = state.items.reduce((acc, row) => acc + row.custo_total_brl, 0)
      return mensagens > 0 ? custo / mensagens : 0
    },

    detalheTotalCustoBrl(state): number {
      return state.detalheTotais.custo_brl
    },

    detalheTotalTokens(state): number {
      return state.detalheTotais.total_tokens
    },

    detalheTotalPalavras(state): number {
      return state.detalheTotais.total_palavras
    },

    detalheTotalLetras(state): number {
      return state.detalheTotais.total_letras
    },

    detalheTotalMensagens(state): number {
      return state.detalheTotais.total_mensagens
    },

    detalheCustoPorLetra(state): number {
      return state.detalheTotais.custo_por_letra
    },

    detalheCustoPorMensagem(state): number {
      return state.detalheTotais.custo_por_mensagem
    },
  },

  actions: {
    clearDetalhe() {
      this.detalheWorkspaceId = null
      this.detalheCanalId = null
      this.detalheDataInicio = null
      this.detalheDataFinal = null
      this.detalheWorkspaceNome = null
      this.detalheNomeCanal = ''
      this.detalheTotais = { ...TOTAIS_ZERADOS }
      this.detalhePending = false
      this.detalheLoaded = false
      this.detalheError = null
      this.detalheLoadedKey = ''
    },

    clear() {
      this.modo = 'custos'
      this.items = []
      this.erros = []
      this.pending = false
      this.loaded = false
      this.errosLoaded = false
      this.error = null
      this.clearDetalhe()
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

    async fetchDetalheCanal({
      canalId,
      dataInicio = null,
      dataFinal = null,
      force = false,
    }: {
      canalId: number | null
      dataInicio?: string | null
      dataFinal?: string | null
      force?: boolean
    }) {
      const inicio = dataInicio?.trim() || null
      const fim = dataFinal?.trim() || null
      const key = detalheKey(canalId, inicio, fim)
      if (!force && this.detalheLoaded && !this.detalheError && this.detalheLoadedKey === key) {
        return
      }

      this.detalhePending = true
      this.detalheError = null
      this.detalheCanalId = canalId
      this.detalheDataInicio = inicio
      this.detalheDataFinal = fim

      try {
        const query: Record<string, string | number> = {
          canal_id: canalId == null ? CUSTO_IA_SEM_CANAL_SLUG : canalId,
        }
        if (inicio && fim) {
          query.data_inicio = inicio
          query.data_final = fim
        }

        const res = await $fetch<AdminCustosIaPorCanalResponse>('/api/admin/custos-da-ia/por-canal', {
          method: 'GET',
          query,
        })
        this.detalheTotais = res.totais ?? { ...TOTAIS_ZERADOS }
        this.detalheWorkspaceId = res.workspace_id
        this.detalheWorkspaceNome = res.workspace_nome
        this.detalheNomeCanal = res.nome_canal
        this.detalheLoaded = true
        this.detalheLoadedKey = key
      } catch (err) {
        this.detalheError = mensagemErroFetch(
          err,
          'Não foi possível carregar os custos deste canal.',
        )
        this.detalheLoaded = true
        this.detalheLoadedKey = ''
        throw err
      } finally {
        this.detalhePending = false
      }
    },
  },
})
