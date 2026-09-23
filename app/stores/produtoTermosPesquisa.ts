import { defineStore } from 'pinia'
import type {
  ProdutoTermoPesquisaDetalhado,
  ProdutoTermoPesquisaItem,
  ProdutosTermosPesquisaDetalhadosResponse,
  ProdutosTermosPesquisaListaResponse,
} from '#shared/types/produtos'

const LIMITE_LISTA_COMPLETA = 2000
const LIMITE_TYPEAHEAD = 30
const PAGE_TODOS_TERMOS = 20

/**
 * Dedupe de GET em voo — **fora** do `state` do Pinia: `Promise` não é POJO
 * e quebra o payload SSR (`devalue` → Cannot stringify arbitrary non-POJOs).
 */
const fetchesEmCurso = new Map<number, Promise<void>>()

export const useProdutoTermosPesquisaStore = defineStore('produtoTermosPesquisa', {
  state: () => ({
    listaCompletaPorWorkspaceId: {} as Record<number, ProdutoTermoPesquisaItem[] | undefined>,
    /** Lista detalhada do modal «Gerenciar termos» (paginada). */
    todos_termos: [] as ProdutoTermoPesquisaDetalhado[],
    todosTermosWorkspaceId: null as number | null,
    todosTermosOffset: 0,
    todosTermosHasMore: false,
    todosTermosPending: false,
    /** Filtro de nome ativo na listagem detalhada (`q` da API). */
    todosTermosQ: '' as string,
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

      const pendente = fetchesEmCurso.get(workspaceId)
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

      fetchesEmCurso.set(workspaceId, p)
      try {
        await p
      } finally {
        fetchesEmCurso.delete(workspaceId)
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
      lista.sort(
        (a, b) =>
          (a.ordem ?? 0) - (b.ordem ?? 0) ||
          a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }),
      )
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
      lista.sort(
        (a, b) =>
          (a.ordem ?? 0) - (b.ordem ?? 0) ||
          a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }),
      )
      this.listaCompletaPorWorkspaceId[workspaceId] = lista
    },

    /** Substitui a lista completa já na ordem desejada (após reordenar). */
    definirListaCompleta(workspaceId: number, itens: ProdutoTermoPesquisaItem[]) {
      this.listaCompletaPorWorkspaceId[workspaceId] = itens.map((x) => ({ ...x }))
    },

    limparCache(workspaceId: number) {
      delete this.listaCompletaPorWorkspaceId[workspaceId]
      fetchesEmCurso.delete(workspaceId)
    },

    limparTodosTermos() {
      this.todos_termos = []
      this.todosTermosWorkspaceId = null
      this.todosTermosOffset = 0
      this.todosTermosHasMore = false
      this.todosTermosPending = false
      this.todosTermosQ = ''
    },

    atualizarNomeTodosTermos(termoId: number, nome: string) {
      this.todos_termos = this.todos_termos.map((t) =>
        t.id === termoId ? { ...t, nome } : t,
      )
    },

    removerTodosTermos(termoId: number) {
      this.todos_termos = this.todos_termos.filter((t) => t.id !== termoId)
      if (this.todosTermosOffset > 0) this.todosTermosOffset = Math.max(0, this.todosTermosOffset - 1)
    },

    /**
     * Após transferir vínculos e eliminar a origem: remove o termo de origem
     * e funde os produtos no destino (se estiver na lista carregada).
     */
    aposTransferirTodosTermos(
      origemId: number,
      destinoId: number,
      produtosOrigem: ProdutoTermoPesquisaDetalhado['produtos'],
    ) {
      const produtos = Array.isArray(produtosOrigem) ? produtosOrigem : []
      this.todos_termos = this.todos_termos
        .filter((t) => t.id !== origemId)
        .map((t) => {
          if (t.id !== destinoId) return t
          const ids = new Set(t.produtos.map((p) => p.id))
          const novos = produtos.filter((p) => p.id > 0 && !ids.has(p.id))
          const merged = [...t.produtos, ...novos]
          return {
            ...t,
            produtos: merged,
            total_usos: merged.length,
            em_uso: merged.length > 0,
          }
        })
      if (this.todosTermosOffset > 0) this.todosTermosOffset = Math.max(0, this.todosTermosOffset - 1)
    },

    /**
     * Carrega página de `view_termos_pesquisa_detalhada` (20 itens).
     * `append: false` reinicia a lista; `true` acrescenta a próxima página.
     * `q` filtra por nome (vazio = listagem padrão).
     */
    async carregarTodosTermos(
      workspaceId: number,
      opts?: { append?: boolean; q?: string },
    ): Promise<void> {
      if (workspaceId < 1) return

      const append = opts?.append === true
      if (append && this.todosTermosPending) return
      if (append && !this.todosTermosHasMore) return

      const q =
        opts?.q !== undefined
          ? String(opts.q).trim()
          : append
            ? this.todosTermosQ
            : ''

      if (!append) {
        this.todos_termos = []
        this.todosTermosOffset = 0
        this.todosTermosHasMore = false
        this.todosTermosWorkspaceId = workspaceId
        this.todosTermosQ = q
      }

      const offset = append ? this.todosTermosOffset : 0
      this.todosTermosPending = true
      try {
        const query: Record<string, string | number> = {
          workspace_id: workspaceId,
          offset,
        }
        if (q.length > 0) query.q = q

        const res = await $fetch<ProdutosTermosPesquisaDetalhadosResponse>(
          '/api/produtos/termos-de-pesquisa/detalhados',
          { query },
        )
        const batch = res.data ?? []
        this.todos_termos = append ? [...this.todos_termos, ...batch] : batch
        this.todosTermosOffset = offset + batch.length
        this.todosTermosHasMore = Boolean(res.has_more)
        this.todosTermosWorkspaceId = workspaceId
      } finally {
        this.todosTermosPending = false
      }
    },

    async carregarMaisTodosTermos(): Promise<void> {
      const wid = this.todosTermosWorkspaceId
      if (wid == null || wid < 1) return
      await this.carregarTodosTermos(wid, { append: true })
    },
  },
})
