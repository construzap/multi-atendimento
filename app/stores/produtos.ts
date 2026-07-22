import { defineStore } from 'pinia'
import type {
  ProdutoCriarEmMassaLinha,
  ProdutoImagemItem,
  ProdutoOportunidadeVendaItem,
  ProdutoSelecionadoRef,
  ProdutoWorkspaceItem,
  ProdutosBuscaResponse,
  ProdutosCriarEmMassaResponse,
  ProdutosFotosExcluirResponse,
  ProdutosFotosReordenarResponse,
  ProdutosFotosUploadResponse,
  ProdutosOportunidadesVendasExcluirResponse,
  ProdutosOportunidadesVendasListaResponse,
  ProdutosOportunidadesVendasTotalResponse,
} from '#shared/types/produtos'
import { mensagemErroFetch } from '~/stores/canais'
import { useWorkspacesStore } from '~/stores/workspaces'

const CHUNK_CRIAR_EM_MASSA = 10
const CHUNK_FOTOS_PRODUTO = 10

function urlDaImagemItem(img: ProdutoImagemItem): string {
  return String(img.imagem_url ?? img.url ?? '').trim()
}

function idImagemPersistido(id: unknown): id is number {
  return typeof id === 'number' && Number.isFinite(id) && id >= 1
}

function urlImagemPersistivel(img: ProdutoImagemItem): string {
  const u = urlDaImagemItem(img)
  if (!u || u.startsWith('blob:')) return ''
  return u
}

function sanitizarImagensParaPinia(imagens: ProdutoImagemItem[]): ProdutoImagemItem[] {
  return imagens
    .filter((img) => urlImagemPersistivel(img).length > 0 || idImagemPersistido(img.id))
    .map((img) => {
      const u = urlImagemPersistivel(img)
      return {
        ...img,
        imagem_url: u || img.imagem_url,
        url: u || img.url,
      }
    })
}

async function arquivoParaBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

function novoRascunhoCriarEmMassa(): ProdutoWorkspaceItem {
  return {
    id: -1,
    codigo: null,
    nome: '',
    categoria_id: null,
    categoria_nome: null,
    sku: null,
    unidade_venda: null,
    marca: null,
    preco: 0,
    preco_custo: 0,
    preco_promocional: null,
    preco_prazo: null,
    peso_kg: null,
    estoque: null,
    infos_relevantes: null,
    imagem_url: null,
    codigo_ncm: null,
    termos_pesquisa: [],
    codigo_barras_ean: null,
    largura: 0,
    altura: 0,
    comprimento: 0,
    status: true,
    descricao: null,
    parent_id: null,
    tem_variacoes: false,
    atributos: null,
    imagens: [],
    variacoes: [],
  }
}

function parseWorkspaceIdFromPinia(): number | null {
  const raw = useWorkspacesStore().currentWorkspaceId
  if (raw == null || raw === '') return null
  const n = Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  return n
}

function linhaParaPayload(row: ProdutoWorkspaceItem): ProdutoCriarEmMassaLinha {
  return {
    nome: String(row.nome ?? '').trim(),
    sku: row.sku,
    unidade_venda: row.unidade_venda,
    marca: row.marca,
    preco: row.preco,
    preco_custo: row.preco_custo,
    preco_promocional: row.preco_promocional,
    preco_prazo: row.preco_prazo,
    peso_kg: row.peso_kg,
    estoque: row.estoque,
    imagem_url: row.imagem_url,
    infos_relevantes: row.infos_relevantes,
    status: row.status,
    categoria_id: row.categoria_id,
    codigo_ncm: row.codigo_ncm,
    termo_pesquisa: (row.termos_pesquisa ?? [])[0]?.id ?? null,
    codigo_barras_ean: row.codigo_barras_ean,
    largura: row.largura,
    altura: row.altura,
    comprimento: row.comprimento,
  }
}

export const useProdutosStore = defineStore('produtos', {
  state: () => ({
    items: [] as ProdutoWorkspaceItem[],
    total: 0,
    page: 1,
    pageSize: 10,
    listPending: false,
    listError: null as string | null,
    /** Evita refetch quando já temos a mesma página em cache. */
    ultimoSnapshotKey: null as string | null,
    /** Rascunho do modal «Criar produtos em massa» (ids negativos até gravar). */
    criarEmMassaItems: [] as ProdutoWorkspaceItem[],
    criarEmMassaNextTempId: -1,
    criarEmMassaWorkspaceId: null as number | null,
    /**
     * Produtos selecionados para ações (modais, edição em lote, checkboxes, etc.).
     * Ao abrir o modal de imagens numa linha, o alvo entra aqui (por ora, um item).
     */
    selecionados: [] as ProdutoSelecionadoRef[],
    /** Modal de galeria aberto (UI). */
    modalImagensAberto: false,
    /** Rascunho da galeria no modal de imagens. */
    imagensEdicaoRascunho: [] as ProdutoImagemItem[],
    /** Snapshot ao abrir o modal (para diff com a API). */
    imagensEdicaoBaseline: [] as ProdutoImagemItem[],
    imagensEdicaoNextTempId: -1,
    /** Ficheiros locais indexados pelo id temporário negativo. */
    arquivosImagemPorTempId: {} as Record<number, File>,
    progressoFotosAberto: false,
    progressoFotosTotal: 0,
    progressoFotosEnviados: 0,
    progressoFotosErro: null as string | null,
    salvandoImagens: false,

    /** Oportunidades de vendas (`view_produtos_nao_encontrados`). */
    oportunidadesVendas: [] as ProdutoOportunidadeVendaItem[],
    oportunidadesVendasTotal: 0,
    oportunidadesVendasPage: 0,
    oportunidadesVendasPageSize: 10,
    oportunidadesVendasTotalPages: 1,
    oportunidadesVendasWorkspaceId: null as number | null,
    oportunidadesVendasTotalPending: false,
    oportunidadesVendasListPending: false,
    oportunidadesVendasError: null as string | null,
  }),
  getters: {
    totalPages(state): number {
      if (state.total <= 0) return 1
      return Math.ceil(state.total / state.pageSize)
    },

    /** Primeiro selecionado — alvo típico de modais que editam uma linha. */
    selecionadoAtivo(state): ProdutoSelecionadoRef | null {
      return state.selecionados[0] ?? null
    },

    quantidadeSelecionados(state): number {
      return state.selecionados.length
    },

    oportunidadesVendasTemMais(state): boolean {
      return state.oportunidadesVendasPage > 0 && state.oportunidadesVendasPage < state.oportunidadesVendasTotalPages
    },
  },
  actions: {
    makeSnapshotKey(workspaceId: number, input: { page: number; q: string }): string {
      const q = (input.q ?? '').trim()
      return [workspaceId, input.page, this.pageSize, q].join('|')
    },

    temSnapshot(workspaceId: number, input: { page: number; q: string }): boolean {
      if (this.items.length === 0 && this.total === 0) return false
      const k = this.makeSnapshotKey(workspaceId, input)
      return this.ultimoSnapshotKey === k
    },

    /**
     * GET /api/produtos/buscar — lista paginada; `q` filtra só pelo nome (ilike).
     */
    async fetchPagina(workspaceId: number, input: { page: number; q: string }) {
      if (!Number.isFinite(workspaceId) || workspaceId < 1) {
        this.reset()
        return
      }

      // Se já temos exatamente esta página, não refaz a chamada.
      if (this.temSnapshot(workspaceId, input)) return

      this.listPending = true
      this.listError = null

      try {
        const res = await $fetch<ProdutosBuscaResponse>('/api/produtos/buscar', {
          method: 'GET',
          query: {
            workspace_id: workspaceId,
            page: input.page,
            page_size: this.pageSize,
            ...(input.q ? { q: input.q } : {}),
          },
        })
        this.items = res.data ?? []
        this.total = res.total
        this.page = res.page
        this.pageSize = res.page_size
        this.ultimoSnapshotKey = this.makeSnapshotKey(workspaceId, { page: res.page, q: input.q })
      } catch (err) {
        this.items = []
        this.total = 0
        this.listError = mensagemErroFetch(err, 'Não foi possível carregar os produtos.')
        this.ultimoSnapshotKey = null
      } finally {
        this.listPending = false
      }
    },

    aplicarLinhaAtualizada(row: ProdutoWorkspaceItem) {
      const paiIdx = this.items.findIndex((x) => x.id === row.id)
      if (paiIdx !== -1) {
        const prev = this.items[paiIdx]!
        this.items.splice(paiIdx, 1, {
          ...prev,
          ...row,
          parent_id: null,
          variacoes: prev.variacoes,
          imagens: prev.imagens?.length ? prev.imagens : row.imagens,
          termos_pesquisa: row.termos_pesquisa ?? prev.termos_pesquisa ?? [],
          tem_variacoes: prev.tem_variacoes,
        })
        this.ultimoSnapshotKey = null
        return
      }
      for (let i = 0; i < this.items.length; i++) {
        const pai = this.items[i]!
        const vIdx = pai.variacoes.findIndex((v) => v.id === row.id)
        if (vIdx === -1) continue
        const prevVar = pai.variacoes[vIdx]!
        const nextVars = pai.variacoes.slice()
        nextVars[vIdx] = {
          ...prevVar,
          ...row,
          parent_id: prevVar.parent_id,
          termos_pesquisa: row.termos_pesquisa ?? prevVar.termos_pesquisa ?? [],
        }
        this.items.splice(i, 1, { ...pai, variacoes: nextVars })
        this.ultimoSnapshotKey = null
        return
      }
    },

    /**
     * Remove produtos da listagem Pinia de imediato (exclusão otimista).
     * Retorna snapshot para restaurar se a API falhar.
     */
    removerProdutosOtimista(ids: number[]): {
      items: ProdutoWorkspaceItem[]
      total: number
      idsAfetados: number[]
    } {
      const idSet = new Set(ids.filter((id) => Number.isFinite(id) && id >= 1))
      const snapshot = {
        items: this.items.map((p) => ({
          ...p,
          variacoes: (p.variacoes ?? []).map((v) => ({ ...v })),
        })),
        total: this.total,
        idsAfetados: [...idSet],
      }
      if (!idSet.size) return snapshot

      let paisRemovidos = 0
      const next: ProdutoWorkspaceItem[] = []
      for (const pai of this.items) {
        if (idSet.has(pai.id)) {
          paisRemovidos += 1
          continue
        }
        const vars = (pai.variacoes ?? []).filter((v) => !idSet.has(v.id))
        if (vars.length !== (pai.variacoes ?? []).length) {
          next.push({
            ...pai,
            variacoes: vars,
            tem_variacoes: vars.length > 0,
          })
        } else {
          next.push(pai)
        }
      }
      this.items = next
      this.total = Math.max(0, this.total - paisRemovidos)
      this.ultimoSnapshotKey = null
      return snapshot
    },

    /** Restaura listagem após falha na exclusão otimista. */
    restaurarProdutosOtimista(snapshot: {
      items: ProdutoWorkspaceItem[]
      total: number
    }) {
      this.items = snapshot.items.map((p) => ({
        ...p,
        variacoes: (p.variacoes ?? []).map((v) => ({ ...v })),
      }))
      this.total = snapshot.total
      this.ultimoSnapshotKey = null
    },

    reset() {
      this.items = []
      this.total = 0
      this.page = 1
      this.pageSize = 10
      this.listPending = false
      this.listError = null
      this.ultimoSnapshotKey = null
      this.limparCriarEmMassa()
      this.resetOportunidadesVendas()
    },

    resetOportunidadesVendas() {
      this.oportunidadesVendas = []
      this.oportunidadesVendasTotal = 0
      this.oportunidadesVendasPage = 0
      this.oportunidadesVendasTotalPages = 1
      this.oportunidadesVendasWorkspaceId = null
      this.oportunidadesVendasTotalPending = false
      this.oportunidadesVendasListPending = false
      this.oportunidadesVendasError = null
    },

    /** Contagem para o banner (sem carregar a lista). */
    async fetchOportunidadesVendasTotal(workspaceId: number) {
      if (!Number.isFinite(workspaceId) || workspaceId < 1) return
      if (this.oportunidadesVendasWorkspaceId != null && this.oportunidadesVendasWorkspaceId !== workspaceId) {
        this.oportunidadesVendas = []
        this.oportunidadesVendasPage = 0
        this.oportunidadesVendasTotalPages = 1
      }
      this.oportunidadesVendasWorkspaceId = workspaceId
      this.oportunidadesVendasTotalPending = true
      this.oportunidadesVendasError = null
      try {
        const res = await $fetch<ProdutosOportunidadesVendasTotalResponse>(
          '/api/produtos/oportunidades-de-vendas/total',
          {
            method: 'GET',
            query: { workspace_id: workspaceId },
          },
        )
        this.oportunidadesVendasTotal = res.total ?? 0
      } catch (err) {
        this.oportunidadesVendasTotal = 0
        this.oportunidadesVendasError = mensagemErroFetch(
          err,
          'Não foi possível carregar o total de oportunidades.',
        )
      } finally {
        this.oportunidadesVendasTotalPending = false
      }
    },

    /**
     * Lista paginada (10). `reset: true` na abertura do modal; senão anexa («Carregar mais»).
     */
    async fetchOportunidadesVendasPagina(opts?: { reset?: boolean }) {
      const workspaceId = this.oportunidadesVendasWorkspaceId ?? parseWorkspaceIdFromPinia()
      if (workspaceId == null) {
        throw new Error('Workspace inválido.')
      }
      this.oportunidadesVendasWorkspaceId = workspaceId

      const reset = opts?.reset === true || this.oportunidadesVendasPage < 1
      const nextPage = reset ? 1 : this.oportunidadesVendasPage + 1
      if (!reset && nextPage > this.oportunidadesVendasTotalPages) return

      this.oportunidadesVendasListPending = true
      this.oportunidadesVendasError = null
      try {
        const res = await $fetch<ProdutosOportunidadesVendasListaResponse>(
          '/api/produtos/oportunidades-de-vendas',
          {
            method: 'GET',
            query: {
              workspace_id: workspaceId,
              page: nextPage,
              page_size: this.oportunidadesVendasPageSize,
            },
          },
        )
        const batch = res.data ?? []
        this.oportunidadesVendas = reset ? batch : [...this.oportunidadesVendas, ...batch]
        this.oportunidadesVendasPage = res.page
        this.oportunidadesVendasPageSize = res.page_size
        this.oportunidadesVendasTotalPages = res.total_pages
        this.oportunidadesVendasTotal = res.total
      } catch (err) {
        this.oportunidadesVendasError = mensagemErroFetch(
          err,
          'Não foi possível carregar as sugestões de produtos.',
        )
        throw err
      } finally {
        this.oportunidadesVendasListPending = false
      }
    },

    removerOportunidadeVenda(item: ProdutoOportunidadeVendaItem) {
      const chave = `${item.workspace_id}:${item.canal_id ?? 'x'}:${item.produto_chave}`
      const before = this.oportunidadesVendas.length
      this.oportunidadesVendas = this.oportunidadesVendas.filter(
        (x) => `${x.workspace_id}:${x.canal_id ?? 'x'}:${x.produto_chave}` !== chave,
      )
      if (this.oportunidadesVendas.length < before) {
        this.oportunidadesVendasTotal = Math.max(0, this.oportunidadesVendasTotal - 1)
      }
    },

    /**
     * Apaga todas as ocorrências da oportunidade em `produtos_nao_encontrados`
     * (ids de `item.ocorrencias[].id`) e remove a linha do Pinia.
     */
    async excluirOportunidadeVenda(opts: {
      workspaceId: number
      item: ProdutoOportunidadeVendaItem
      onProgress?: (enviados: number, total: number) => void
    }): Promise<ProdutosOportunidadesVendasExcluirResponse> {
      const ids = [
        ...new Set(
          (opts.item.ocorrencias ?? [])
            .map((o) => o.id)
            .filter((id): id is number => typeof id === 'number' && Number.isFinite(id) && id > 0),
        ),
      ]
      if (ids.length === 0) {
        throw new Error('Esta sugestão não tem ocorrências para apagar.')
      }

      const total = ids.length
      opts.onProgress?.(0, total)

      const res = await $fetch<ProdutosOportunidadesVendasExcluirResponse>(
        '/api/produtos/oportunidades-de-vendas/excluir',
        {
          method: 'POST',
          body: {
            workspace_id: opts.workspaceId,
            ids,
          },
        },
      )

      opts.onProgress?.(total, total)
      this.removerOportunidadeVenda(opts.item)
      return res
    },

    /**
     * Cria produto via `POST /api/produtos/criar-em-massa` (já valida `checkLimiteProdutos`).
     * Em sucesso apaga as ocorrências em `produtos_nao_encontrados` e remove a sugestão do Pinia.
     */
    async cadastrarProdutoDeOportunidade(opts: {
      workspaceId: number
      item: ProdutoOportunidadeVendaItem
      preco: number
      /** Id de `produto_termo_de_pesquisa` → coluna `termo_pesquisa`. */
      termoPesquisaId?: number | null
    }): Promise<void> {
      const nome = String(opts.item.produto_sugerido ?? '').trim()
      if (!nome) throw new Error('Nome do produto inválido.')
      const preco = Number.isFinite(opts.preco) && opts.preco >= 0 ? opts.preco : 0
      const termoId =
        opts.termoPesquisaId != null &&
        Number.isFinite(opts.termoPesquisaId) &&
        opts.termoPesquisaId > 0
          ? Math.trunc(opts.termoPesquisaId)
          : null

      await $fetch<ProdutosCriarEmMassaResponse>('/api/produtos/criar-em-massa', {
        method: 'POST',
        body: {
          workspace_id: opts.workspaceId,
          linhas: [{ nome, preco, termo_pesquisa: termoId }],
        },
      })

      const idsOcorrencias = [
        ...new Set(
          (opts.item.ocorrencias ?? [])
            .map((o) => o.id)
            .filter((id): id is number => typeof id === 'number' && Number.isFinite(id) && id > 0),
        ),
      ]
      if (idsOcorrencias.length > 0) {
        await $fetch<ProdutosOportunidadesVendasExcluirResponse>(
          '/api/produtos/oportunidades-de-vendas/excluir',
          {
            method: 'POST',
            body: {
              workspace_id: opts.workspaceId,
              ids: idsOcorrencias,
            },
          },
        )
      }

      this.removerOportunidadeVenda(opts.item)
      this.ultimoSnapshotKey = null
    },

    /** Limpa o rascunho de criação em massa (após envio bem-sucedido ou cancelar). */
    limparCriarEmMassa() {
      this.criarEmMassaItems = []
      this.criarEmMassaNextTempId = -1
      this.criarEmMassaWorkspaceId = null
    },

    ordenarImagensPorOrdem(imagens: ProdutoImagemItem[]): ProdutoImagemItem[] {
      return [...imagens].sort((a, b) => {
        const oa = typeof a.ordem === 'number' ? a.ordem : 9999
        const ob = typeof b.ordem === 'number' ? b.ordem : 9999
        return oa - ob
      })
    },

    urlImagemPrincipal(imagens: ProdutoImagemItem[]): string | null {
      const sorted = this.ordenarImagensPorOrdem(imagens)
      for (const img of sorted) {
        const u = urlDaImagemItem(img)
        if (u) return u
      }
      return null
    },

    revogarBlobUrlsImagensEdicao() {
      for (const img of this.imagensEdicaoRascunho) {
        const u = urlDaImagemItem(img)
        if (u.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(u)
          } catch {
            /* ignore */
          }
        }
      }
    },

    limparEstadoEdicaoImagens() {
      this.revogarBlobUrlsImagensEdicao()
      this.imagensEdicaoRascunho = []
      this.imagensEdicaoBaseline = []
      this.arquivosImagemPorTempId = {}
    },

    chaveSelecionadoRef(ref: ProdutoSelecionadoRef): string {
      return [ref.contexto, ref.parentId ?? '', ref.produtoId].join(':')
    },

    limparSelecionados() {
      this.selecionados = []
    },

    definirSelecionados(refs: ProdutoSelecionadoRef[]) {
      this.selecionados = refs.map((r) => ({ ...r }))
    },

    alternarSelecionado(ref: ProdutoSelecionadoRef, marcado: boolean) {
      const k = this.chaveSelecionadoRef(ref)
      const idx = this.selecionados.findIndex((s) => this.chaveSelecionadoRef(s) === k)
      if (marcado) {
        if (idx === -1) this.selecionados = [...this.selecionados, { ...ref }]
        return
      }
      if (idx !== -1) {
        const next = this.selecionados.slice()
        next.splice(idx, 1)
        this.selecionados = next
      }
    },

    estaSelecionado(ref: ProdutoSelecionadoRef): boolean {
      const k = this.chaveSelecionadoRef(ref)
      return this.selecionados.some((s) => this.chaveSelecionadoRef(s) === k)
    },

    /** Aplica alterações em memória num produto referenciado em `selecionados`. */
    aplicarEmProdutoSelecionado(
      ref: ProdutoSelecionadoRef,
      patch: Partial<Pick<ProdutoWorkspaceItem, 'imagens' | 'imagem_url'>>,
    ) {
      const imagens = patch.imagens
      const imagem_url = patch.imagem_url

      if (ref.contexto === 'rascunho') {
        const i = this.criarEmMassaItems.findIndex((x) => x.id === ref.produtoId)
        if (i === -1) return
        const row = this.criarEmMassaItems[i]!
        const next = this.criarEmMassaItems.slice()
        next[i] = {
          ...row,
          ...(imagens !== undefined ? { imagens } : {}),
          ...(imagem_url !== undefined ? { imagem_url } : {}),
        }
        this.criarEmMassaItems = next
        return
      }

      if (ref.tipo === 'pai' || ref.parentId == null) {
        const paiIdx = this.items.findIndex((x) => x.id === ref.produtoId)
        if (paiIdx === -1) return
        const prev = this.items[paiIdx]!
        this.items.splice(paiIdx, 1, {
          ...prev,
          ...(imagens !== undefined ? { imagens } : {}),
          ...(imagem_url !== undefined ? { imagem_url } : {}),
        })
        return
      }

      const pIdx = this.items.findIndex((x) => x.id === ref.parentId)
      if (pIdx === -1) return
      const pai = this.items[pIdx]!
      const vIdx = pai.variacoes.findIndex((v) => v.id === ref.produtoId)
      if (vIdx === -1) return
      const nextVars = pai.variacoes.slice()
      nextVars[vIdx] = {
        ...nextVars[vIdx]!,
        ...(imagens !== undefined ? { imagens } : {}),
        ...(imagem_url !== undefined ? { imagem_url } : {}),
      }
      this.items.splice(pIdx, 1, { ...pai, variacoes: nextVars })
    },

    normalizarOrdensImagensEdicao() {
      this.imagensEdicaoRascunho = this.imagensEdicaoRascunho.map((img, i) => ({ ...img, ordem: i }))
    },

    abrirModalImagens(opts: {
      ref: ProdutoSelecionadoRef
      imagens: ProdutoImagemItem[]
    }) {
      this.limparEstadoEdicaoImagens()
      this.definirSelecionados([opts.ref])
      const ordenadas = this.ordenarImagensPorOrdem(opts.imagens ?? []).map((img, i) => ({
        ...img,
        url: urlDaImagemItem(img) || img.url,
        imagem_url: urlDaImagemItem(img) || img.imagem_url,
        ordem: i,
        produto_id: opts.ref.produtoId,
      }))
      this.imagensEdicaoBaseline = ordenadas.map((img) => ({ ...img }))
      this.imagensEdicaoRascunho = ordenadas.map((img) => ({ ...img }))
      this.modalImagensAberto = true
    },

    async fecharModalImagens(aplicar = false) {
      if (!aplicar) {
        await this.reverterUploadsImagensSessao()
        this.limparEstadoEdicaoImagens()
      }
      this.modalImagensAberto = false
      if (!aplicar) this.limparSelecionados()
    },

    /** Remove do servidor imagens enviadas nesta sessão se o modal for cancelado. */
    async reverterUploadsImagensSessao() {
      const ref = this.selecionadoAtivo
      if (!ref || !this.podeSalvarImagensNaApi()) return

      const workspaceId = parseWorkspaceIdFromPinia()
      if (workspaceId == null) return

      const baselineIds = new Set(
        this.imagensEdicaoBaseline
          .filter((x) => idImagemPersistido(x.id))
          .map((x) => x.id as number),
      )
      const paraExcluir = this.imagensEdicaoRascunho
        .filter((x) => idImagemPersistido(x.id) && !baselineIds.has(x.id as number))
        .map((x) => x.id as number)

      if (!paraExcluir.length) return

      try {
        for (let i = 0; i < paraExcluir.length; i += CHUNK_FOTOS_PRODUTO) {
          const chunk = paraExcluir.slice(i, i + CHUNK_FOTOS_PRODUTO)
          await $fetch<ProdutosFotosExcluirResponse>('/api/produtos/fotosblackblaze/excluir', {
            method: 'POST',
            body: { workspace_id: workspaceId, produto_id: ref.produtoId, ids: chunk },
          })
        }
      } catch {
        /* cancelamento best-effort */
      }
    },

    adicionarImagemEdicaoPorUrl(url: string) {
      const u = url.trim()
      if (!u) return
      const sel = this.selecionadoAtivo
      const id = this.imagensEdicaoNextTempId
      this.imagensEdicaoNextTempId -= 1
      this.imagensEdicaoRascunho = [
        ...this.imagensEdicaoRascunho,
        {
          id,
          produto_id: sel?.produtoId,
          url: u,
          imagem_url: u,
          ordem: this.imagensEdicaoRascunho.length,
        },
      ]
    },

    async enviarUrlImagemEdicaoApi(url: string) {
      const ref = this.selecionadoAtivo
      const workspaceId = parseWorkspaceIdFromPinia()
      if (!ref || workspaceId == null) {
        throw new Error('Produto ou workspace inválido.')
      }

      const ordem = this.imagensEdicaoRascunho.length
      const res = await $fetch<ProdutosFotosUploadResponse>('/api/produtos/fotosblackblaze/adicionar-url', {
        method: 'POST',
        body: {
          workspace_id: workspaceId,
          produto_id: ref.produtoId,
          itens: [{ imagem_url: url, ordem }],
        },
      })

      const inserida = res.data?.[0]
      if (!inserida) {
        throw new Error('Não foi possível guardar a URL da imagem.')
      }

      this.imagensEdicaoRascunho = [
        ...this.imagensEdicaoRascunho,
        { ...inserida, ordem, produto_id: ref.produtoId },
      ]
    },

    adicionarImagemEdicaoPorArquivo(file: File) {
      const sel = this.selecionadoAtivo
      const id = this.imagensEdicaoNextTempId
      this.imagensEdicaoNextTempId -= 1
      this.arquivosImagemPorTempId = { ...this.arquivosImagemPorTempId, [id]: file }
      const blobUrl = URL.createObjectURL(file)
      this.imagensEdicaoRascunho = [
        ...this.imagensEdicaoRascunho,
        {
          id,
          produto_id: sel?.produtoId,
          url: blobUrl,
          imagem_url: blobUrl,
          ordem: this.imagensEdicaoRascunho.length,
        },
      ]
    },

    async enviarArquivoImagemEdicaoApi(file: File) {
      const ref = this.selecionadoAtivo
      const workspaceId = parseWorkspaceIdFromPinia()
      if (!ref || workspaceId == null) {
        throw new Error('Produto ou workspace inválido.')
      }

      const ordem = this.imagensEdicaoRascunho.length
      const res = await $fetch<ProdutosFotosUploadResponse>('/api/produtos/fotosblackblaze/upload', {
        method: 'POST',
        body: {
          workspace_id: workspaceId,
          produto_id: ref.produtoId,
          itens: [
            {
              mime: file.type || 'image/jpeg',
              data_base64: await arquivoParaBase64(file),
              ordem,
              filename: file.name,
            },
          ],
        },
      })

      const inserida = res.data?.[0]
      if (!inserida) {
        throw new Error('Não foi possível enviar a imagem.')
      }

      this.imagensEdicaoRascunho = [
        ...this.imagensEdicaoRascunho,
        { ...inserida, ordem, produto_id: ref.produtoId },
      ]
    },

    removerImagemEdicao(index: number) {
      if (index < 0 || index >= this.imagensEdicaoRascunho.length) return
      const removed = this.imagensEdicaoRascunho[index]
      const u = removed ? urlDaImagemItem(removed) : ''
      if (u.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(u)
        } catch {
          /* ignore */
        }
      }
      if (removed?.id != null && removed.id < 0) {
        const nextMap = { ...this.arquivosImagemPorTempId }
        delete nextMap[removed.id]
        this.arquivosImagemPorTempId = nextMap
      }
      const next = this.imagensEdicaoRascunho.slice()
      next.splice(index, 1)
      this.imagensEdicaoRascunho = next
      this.normalizarOrdensImagensEdicao()
    },

    moverImagemEdicao(index: number, direcao: -1 | 1) {
      const alvo = index + direcao
      if (alvo < 0 || alvo >= this.imagensEdicaoRascunho.length) return
      const next = this.imagensEdicaoRascunho.slice()
      const tmp = next[index]!
      next[index] = next[alvo]!
      next[alvo] = tmp
      this.imagensEdicaoRascunho = next
      this.normalizarOrdensImagensEdicao()
    },

    /** Aplica galeria editada no produto selecionado (sem API — rascunho). */
    persistirImagensEdicaoLocal() {
      const ref = this.selecionadoAtivo
      if (!ref) return
      this.normalizarOrdensImagensEdicao()
      const imagens = sanitizarImagensParaPinia(this.imagensEdicaoRascunho.map((img) => ({ ...img })))
      const imagem_url = this.urlImagemPrincipal(imagens)
      this.aplicarEmProdutoSelecionado(ref, { imagens, imagem_url })
      this.limparEstadoEdicaoImagens()
      this.limparSelecionados()
    },

    podeSalvarImagensNaApi(): boolean {
      const ref = this.selecionadoAtivo
      return ref != null && ref.contexto === 'lista' && ref.produtoId >= 1
    },

    async salvarImagensEdicao(opts?: { signal?: AbortSignal }): Promise<{ ok: boolean; cancelado?: boolean }> {
      if (!this.podeSalvarImagensNaApi()) {
        this.persistirImagensEdicaoLocal()
        this.modalImagensAberto = false
        return { ok: true }
      }

      const ref = this.selecionadoAtivo!
      const workspaceId = parseWorkspaceIdFromPinia()
      if (workspaceId == null) {
        throw new Error('Workspace inválido.')
      }

      this.normalizarOrdensImagensEdicao()
      const baseline = this.imagensEdicaoBaseline
      const current = this.imagensEdicaoRascunho

      const idsAtuais = new Set(
        current.filter((x) => idImagemPersistido(x.id)).map((x) => x.id as number),
      )
      const paraExcluir = baseline
        .filter((b) => idImagemPersistido(b.id) && !idsAtuais.has(b.id as number))
        .map((b) => b.id as number)

      const paraUpload: { tempId: number; file: File; ordem: number }[] = []
      const paraUrl: { url: string; ordem: number }[] = []

      for (let i = 0; i < current.length; i += 1) {
        const img = current[i]!
        const ordem = i
        if (idImagemPersistido(img.id)) continue
        const tempId = typeof img.id === 'number' ? img.id : -1
        const file = this.arquivosImagemPorTempId[tempId]
        if (file) {
          paraUpload.push({ tempId, file, ordem })
          continue
        }
        const u = urlDaImagemItem(img)
        if (u && !u.startsWith('blob:') && (u.startsWith('http://') || u.startsWith('https://'))) {
          paraUrl.push({ url: u, ordem })
        }
      }

      const opsExcluir = Math.ceil(paraExcluir.length / CHUNK_FOTOS_PRODUTO) || 0
      const opsUpload = Math.ceil(paraUpload.length / CHUNK_FOTOS_PRODUTO) || 0
      const opsUrl = Math.ceil(paraUrl.length / CHUNK_FOTOS_PRODUTO) || 0
      const totalOps =
        (paraExcluir.length ? opsExcluir : 0) +
        (paraUpload.length ? opsUpload : 0) +
        (paraUrl.length ? opsUrl : 0) +
        1

      this.progressoFotosTotal = Math.max(1, totalOps)
      this.progressoFotosEnviados = 0
      this.progressoFotosErro = null
      this.progressoFotosAberto = true
      this.salvandoImagens = true

      const inseridasNovas: ProdutoImagemItem[] = []
      let step = 0

      try {
        for (let i = 0; i < paraExcluir.length; i += CHUNK_FOTOS_PRODUTO) {
          if (opts?.signal?.aborted) return { ok: false, cancelado: true }
          const chunk = paraExcluir.slice(i, i + CHUNK_FOTOS_PRODUTO)
          await $fetch<ProdutosFotosExcluirResponse>('/api/produtos/fotosblackblaze/excluir', {
            method: 'POST',
            body: { workspace_id: workspaceId, produto_id: ref.produtoId, ids: chunk },
            signal: opts?.signal,
          })
          step += 1
          this.progressoFotosEnviados = step
        }

        for (let i = 0; i < paraUpload.length; i += CHUNK_FOTOS_PRODUTO) {
          if (opts?.signal?.aborted) return { ok: false, cancelado: true }
          const chunk = paraUpload.slice(i, i + CHUNK_FOTOS_PRODUTO)
          const itens = await Promise.all(
            chunk.map(async (c) => ({
              mime: c.file.type || 'image/jpeg',
              data_base64: await arquivoParaBase64(c.file),
              ordem: c.ordem,
              filename: c.file.name,
            })),
          )
          const res = await $fetch<ProdutosFotosUploadResponse>('/api/produtos/fotosblackblaze/upload', {
            method: 'POST',
            body: { workspace_id: workspaceId, produto_id: ref.produtoId, itens },
            signal: opts?.signal,
          })
          inseridasNovas.push(...(res.data ?? []))
          step += 1
          this.progressoFotosEnviados = step
        }

        for (let i = 0; i < paraUrl.length; i += CHUNK_FOTOS_PRODUTO) {
          if (opts?.signal?.aborted) return { ok: false, cancelado: true }
          const chunk = paraUrl.slice(i, i + CHUNK_FOTOS_PRODUTO)
          const res = await $fetch<ProdutosFotosUploadResponse>(
            '/api/produtos/fotosblackblaze/adicionar-url',
            {
              method: 'POST',
              body: {
                workspace_id: workspaceId,
                produto_id: ref.produtoId,
                itens: chunk.map((c) => ({ imagem_url: c.url, ordem: c.ordem })),
              },
              signal: opts?.signal,
            },
          )
          inseridasNovas.push(...(res.data ?? []))
          step += 1
          this.progressoFotosEnviados = step
        }

        const mapNovasPorOrdem = new Map<number, ProdutoImagemItem[]>()
        for (const n of inseridasNovas) {
          const o = typeof n.ordem === 'number' ? n.ordem : 0
          const list = mapNovasPorOrdem.get(o) ?? []
          list.push(n)
          mapNovasPorOrdem.set(o, list)
        }

        const imagensFinais: ProdutoImagemItem[] = []
        for (let i = 0; i < current.length; i += 1) {
          const img = current[i]!
          if (idImagemPersistido(img.id)) {
            imagensFinais.push({ ...img, ordem: i })
            continue
          }
          const fila = mapNovasPorOrdem.get(i)
          const nova = fila?.shift()
          if (nova) {
            imagensFinais.push({ ...nova, ordem: i })
          }
        }

        const itensReordenar = imagensFinais
          .filter((img) => idImagemPersistido(img.id))
          .map((img, ordem) => ({ id: img.id as number, ordem }))

        const precisaReordenar =
          itensReordenar.length > 0 &&
          itensReordenar.some((item) => {
            const ant = baseline.find((b) => b.id === item.id)
            return ant == null || ant.ordem !== item.ordem
          })

        if (precisaReordenar) {
          if (opts?.signal?.aborted) return { ok: false, cancelado: true }
          for (let i = 0; i < itensReordenar.length; i += CHUNK_FOTOS_PRODUTO) {
            const chunk = itensReordenar.slice(i, i + CHUNK_FOTOS_PRODUTO)
            const res = await $fetch<ProdutosFotosReordenarResponse>(
              '/api/produtos/fotosblackblaze/reordenar',
              {
                method: 'POST',
                body: {
                  workspace_id: workspaceId,
                  produto_id: ref.produtoId,
                  itens: chunk,
                },
                signal: opts?.signal,
              },
            )
            for (const atualizada of res.data ?? []) {
              const idx = imagensFinais.findIndex((x) => x.id === atualizada.id)
              if (idx !== -1) imagensFinais[idx] = { ...imagensFinais[idx]!, ...atualizada }
            }
          }
        }

        step += 1
        this.progressoFotosEnviados = step

        const imagem_url = this.urlImagemPrincipal(imagensFinais)
        this.aplicarEmProdutoSelecionado(ref, {
          imagens: sanitizarImagensParaPinia(imagensFinais),
          imagem_url,
        })
        this.ultimoSnapshotKey = null
        this.limparEstadoEdicaoImagens()
        this.limparSelecionados()
        this.modalImagensAberto = false
        return { ok: true }
      } catch (err) {
        this.progressoFotosErro = mensagemErroFetch(err, 'Não foi possível salvar as imagens.')
        throw err
      } finally {
        this.salvandoImagens = false
        if (!this.progressoFotosErro) this.progressoFotosAberto = false
      }
    },

    adicionarLinhaCriarEmMassa() {
      const id = this.criarEmMassaNextTempId
      this.criarEmMassaNextTempId -= 1
      this.criarEmMassaItems = [...this.criarEmMassaItems, { ...novoRascunhoCriarEmMassa(), id }]
    },

    atualizarLinhaCriarEmMassa(row: ProdutoWorkspaceItem) {
      const i = this.criarEmMassaItems.findIndex((x) => x.id === row.id)
      if (i === -1) return
      const next = this.criarEmMassaItems.slice()
      next[i] = { ...row }
      this.criarEmMassaItems = next
    },

    /** Remove rascunhos sem nome (não serão enviados). */
    removerLinhasCriarEmMassaSemNome() {
      this.criarEmMassaItems = this.criarEmMassaItems.filter(
        (r) => String(r.nome ?? '').trim().length > 0,
      )
    },

    montarPayloadCriarEmMassa(): ProdutoCriarEmMassaLinha[] {
      return this.criarEmMassaItems
        .map((r) => linhaParaPayload(r))
        .filter((r) => r.nome.trim().length > 0)
    },

    /** Linha mínima para variação: só `nome` + `parent_id`. */
    montarLinhaVariacao(parentId: number, nome: string): ProdutoCriarEmMassaLinha {
      return {
        nome: nome.trim(),
        parent_id: parentId,
      }
    },

    /**
     * Cria uma variação via `POST /api/produtos/criar-em-massa`.
     * O pai deve estar em `items` (Pinia); invalida o snapshot da listagem.
     */
    async criarVariacaoProduto(opts: {
      workspaceId: number
      parentId: number
      nome: string
    }): Promise<void> {
      const wid = opts.workspaceId
      const nome = opts.nome.trim()
      if (!nome) throw new Error('Informe o nome da variação.')

      const pai = this.items.find((p) => p.id === opts.parentId)
      if (!pai) throw new Error('Produto pai não encontrado na listagem atual.')

      const linha = this.montarLinhaVariacao(pai.id, nome)

      await $fetch<ProdutosCriarEmMassaResponse>('/api/produtos/criar-em-massa', {
        method: 'POST',
        body: { workspace_id: wid, linhas: [linha] },
      })

      this.ultimoSnapshotKey = null
    },

    /**
     * Envia rascunho da Pinia em lotes para `POST /api/produtos/criar-em-massa`.
     * `workspaceId` opcional; se omitido, usa `currentWorkspaceId` da store de workspaces.
     */
    async enviarCriarEmMassaEmLotes(opts?: {
      workspaceId?: number
      signal?: AbortSignal
      onProgress?: (enviados: number, total: number) => void
    }): Promise<{ inseridos: number; cancelado: boolean }> {
      const wid = opts?.workspaceId ?? parseWorkspaceIdFromPinia()
      if (wid == null) {
        throw new Error('Workspace inválido.')
      }

      const payload = this.montarPayloadCriarEmMassa()
      if (!payload.length) {
        return { inseridos: 0, cancelado: false }
      }

      for (let i = 0; i < payload.length; i += 1) {
        const nome = payload[i]?.nome?.trim() ?? ''
        if (!nome) {
          throw new Error(`Informe o nome do produto na linha ${i + 1}.`)
        }
      }

      let inseridos = 0
      const total = payload.length

      for (let i = 0; i < payload.length; i += CHUNK_CRIAR_EM_MASSA) {
        if (opts?.signal?.aborted) {
          return { inseridos, cancelado: true }
        }
        const chunk = payload.slice(i, i + CHUNK_CRIAR_EM_MASSA)
        const res = await $fetch<ProdutosCriarEmMassaResponse>('/api/produtos/criar-em-massa', {
          method: 'POST',
          body: { workspace_id: wid, linhas: chunk },
          signal: opts?.signal,
        })
        inseridos += res.inseridos ?? chunk.length
        opts?.onProgress?.(inseridos, total)
      }

      return { inseridos, cancelado: false }
    },
  },
})
