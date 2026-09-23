import { defineStore } from 'pinia'
import type { ProdutoCategoriaItem, ProdutosCategoriasListaResponse } from '#shared/types/produtos'

const LIMITE_LISTA_COMPLETA = 2000
const LIMITE_TYPEAHEAD = 30

/**
 * Dedupe de GET em voo — **fora** do `state` do Pinia: `Promise` não é POJO
 * e quebra o payload SSR (`devalue`).
 */
const fetchesEmCurso = new Map<number, Promise<void>>()

/**
 * Cache em memória da lista completa de categorias por workspace (`GET` sem `q`).
 * Evita pedidos repetidos; `aposCriarOuExistirCategoria` mantém a lista após `POST`.
 */
export const useProdutoCategoriasStore = defineStore('produtoCategorias', {
  state: () => ({
    /** `undefined` = ainda não carregou para este `workspace_id`. */
    listaCompletaPorWorkspaceId: {} as Record<number, ProdutoCategoriaItem[] | undefined>,
  }),

  actions: {
    temListaCompletaCarregada(workspaceId: number): boolean {
      return this.listaCompletaPorWorkspaceId[workspaceId] !== undefined
    },

    getListaCompletaCopia(workspaceId: number): ProdutoCategoriaItem[] {
      const lista = this.listaCompletaPorWorkspaceId[workspaceId]
      return lista ? lista.map((x) => ({ ...x })) : []
    },

    /** Filtro local (substring, case-insensitive), alinhado ao uso em typeahead. */
    filtrarPorNome(workspaceId: number, q: string, max = LIMITE_TYPEAHEAD): ProdutoCategoriaItem[] {
      const lista = this.listaCompletaPorWorkspaceId[workspaceId]
      if (!lista) return []
      const t = q.trim().toLowerCase()
      if (!t.length) return lista.slice(0, max)
      return lista.filter((c) => c.nome.toLowerCase().includes(t)).slice(0, max)
    },

    /**
     * Garante que `listaCompletaPorWorkspaceId[workspaceId]` existe (pedido à API se preciso).
     */
    async carregarListaCompletaSeNecessario(workspaceId: number): Promise<void> {
      if (this.listaCompletaPorWorkspaceId[workspaceId] !== undefined) return

      const pendente = fetchesEmCurso.get(workspaceId)
      if (pendente) {
        await pendente
        return
      }

      const p = (async () => {
        const res = await $fetch<ProdutosCategoriasListaResponse>('/api/produtos/categorias', {
          query: {
            workspace_id: workspaceId,
            limit: LIMITE_LISTA_COMPLETA,
          },
        })
        this.listaCompletaPorWorkspaceId[workspaceId] = res.data ?? []
      })()

      fetchesEmCurso.set(workspaceId, p)
      try {
        await p
      } finally {
        fetchesEmCurso.delete(workspaceId)
      }
    },

    /** Após `POST /api/produtos/categorias` (criar ou já existente). */
    aposCriarOuExistirCategoria(workspaceId: number, c: ProdutoCategoriaItem) {
      let lista = this.listaCompletaPorWorkspaceId[workspaceId]
      if (lista === undefined) {
        this.listaCompletaPorWorkspaceId[workspaceId] = [{ ...c }]
        return
      }
      lista = lista.map((x) => ({ ...x }))
      const i = lista.findIndex((x) => x.id === c.id)
      if (i >= 0) lista[i] = { ...c }
      else lista.push({ ...c })
      lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }))
      this.listaCompletaPorWorkspaceId[workspaceId] = lista
    },

    /** Remove da cache após `DELETE /api/produtos/categorias/:id`. */
    removerCategoria(workspaceId: number, categoriaId: number) {
      const lista = this.listaCompletaPorWorkspaceId[workspaceId]
      if (!lista) return
      this.listaCompletaPorWorkspaceId[workspaceId] = lista.filter((x) => x.id !== categoriaId)
    },

    /** Após `PATCH /api/produtos/categorias/:id` (renomear). */
    substituirCategoria(workspaceId: number, item: ProdutoCategoriaItem) {
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
      fetchesEmCurso.delete(workspaceId)
    },
  },
})
