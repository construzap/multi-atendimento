import { defineStore } from 'pinia'
import type {
  ProdutoTermoPesquisaItem,
  ProdutosTermosPesquisaListaResponse,
} from '#shared/types/produtos'

const LIMITE_LISTA_COMPLETA = 2000
const LIMITE_TYPEAHEAD = 30

export const useProdutoTermosPesquisaStore = defineStore('produtoTermosPesquisa', {
  state: () => ({
    listaCompletaPorWorkspaceId: {} as Record<number, ProdutoTermoPesquisaItem[] | undefined>,
    fetchesEmCurso: {} as Record<number, Promise<void>>,
  }),

  actions: {
    temListaCompletaCarregada(workspaceId: number): boolean {
      return this.listaCompletaPorWorkspaceId[workspaceId] !== undefined
    },

    getListaCompletaCopia(workspaceId: number): ProdutoTermoPesquisaItem[] {
      const lista = this.listaCompletaPorWorkspaceId[workspaceId]
      return lista ? lista.map((x) => ({ ...x })) : []
    },

    filtrarPorNome(workspaceId: number, q: string, max = LIMITE_TYPEAHEAD): ProdutoTermoPesquisaItem[] {
      const lista = this.listaCompletaPorWorkspaceId[workspaceId]
      if (!lista) return []
      const t = q.trim().toLowerCase()
      if (!t.length) return lista.slice(0, max)
      return lista.filter((c) => c.nome.toLowerCase().includes(t)).slice(0, max)
    },

    async carregarListaCompletaSeNecessario(workspaceId: number): Promise<void> {
      if (this.listaCompletaPorWorkspaceId[workspaceId] !== undefined) return

      const pendente = this.fetchesEmCurso[workspaceId]
      if (pendente) {
        await pendente
        return
      }

      const p = (async () => {
        const res = await $fetch<ProdutosTermosPesquisaListaResponse>('/api/produtos/termos-de-pesquisa', {
          query: {
            workspace_id: workspaceId,
            limit: LIMITE_LISTA_COMPLETA,
          },
        })
        this.listaCompletaPorWorkspaceId[workspaceId] = res.data ?? []
      })()

      this.fetchesEmCurso[workspaceId] = p
      try {
        await p
      } finally {
        delete this.fetchesEmCurso[workspaceId]
      }
    },

    aposCriarOuExistirTermo(workspaceId: number, t: ProdutoTermoPesquisaItem) {
      let lista = this.listaCompletaPorWorkspaceId[workspaceId]
      if (lista === undefined) {
        this.listaCompletaPorWorkspaceId[workspaceId] = [{ ...t }]
        return
      }
      lista = lista.map((x) => ({ ...x }))
      const i = lista.findIndex((x) => x.id === t.id)
      if (i >= 0) lista[i] = { ...t }
      else lista.push({ ...t })
      lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }))
      this.listaCompletaPorWorkspaceId[workspaceId] = lista
    },

    removerTermo(workspaceId: number, termoId: number) {
      const lista = this.listaCompletaPorWorkspaceId[workspaceId]
      if (!lista) return
      this.listaCompletaPorWorkspaceId[workspaceId] = lista.filter((x) => x.id !== termoId)
    },

    substituirTermo(workspaceId: number, item: ProdutoTermoPesquisaItem) {
      let lista = this.listaCompletaPorWorkspaceId[workspaceId]
      if (lista === undefined) {
        this.listaCompletaPorWorkspaceId[workspaceId] = [{ ...item }]
        return
      }
      lista = lista.map((x) => ({ ...x }))
      const i = lista.findIndex((x) => x.id === item.id)
      if (i >= 0) lista[i] = { ...item }
      else lista.push({ ...item })
      lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }))
      this.listaCompletaPorWorkspaceId[workspaceId] = lista
    },

    invalidarWorkspace(workspaceId: number) {
      delete this.listaCompletaPorWorkspaceId[workspaceId]
      delete this.fetchesEmCurso[workspaceId]
    },
  },
})
