import { defineStore } from 'pinia'
import type {
  LojaCardapioPublico,
  LojaCanalPublico,
  LojaCarrinhoItem,
  LojaEndereco,
  LojaEnderecoCreate,
  LojaEnderecoItemResponse,
  LojaEnderecosListaResponse,
  LojaFormaPagamento,
  LojaLogin,
  LojaModoRecebimento,
  LojaProdutoPublico,
  LojaTermoPublico,
  LojaWorkspacePublico,
  LojaWorkspacePublicoResponse,
} from '#shared/types/loja'

export const useLojaWorkspaceStore = defineStore('loja-workspace', {
  state: () => ({
    id: null as number | null,
    nome: null as string | null,
    logo_url: null as string | null,
    slug: null as string | null,
    canal: null as LojaCanalPublico | null,
    termos: [] as LojaTermoPublico[],
    produtos: [] as LojaProdutoPublico[],
    total_produtos: 0,
    has_more: false,
    loading: false,
    loadingMais: false,
    /** Só true depois que uma busca terminou (sucesso ou erro). */
    buscou: false,
    erro: null as string | null,
    paginaProdutoUnico: null as LojaProdutoPublico | null,
    observacaoProdutoUnico: '',
    /** Sacola da loja atual (espelhada no localStorage por slug). */
    carrinhoAtual: [] as LojaCarrinhoItem[],
    observacaoPedido: '',
    modoRecebimento: 'entrega' as LojaModoRecebimento,
    enderecos: [] as LojaEndereco[],
    enderecoSelecionadoId: null as number | null,
    enderecosLoading: false,
    formaPagamento: null as LojaFormaPagamento | null,
    login: null as LojaLogin | null,
  }),

  getters: {
    carregado(state): boolean {
      return state.id != null && state.nome != null
    },
    aguardando(state): boolean {
      return state.loading || !state.buscou
    },
    carrinhoTotal(state): number {
      return state.carrinhoAtual.reduce((acc, item) => acc + item.preco_unitario * item.quantidade, 0)
    },
    carrinhoQuantidade(state): number {
      return state.carrinhoAtual.reduce((acc, item) => acc + item.quantidade, 0)
    },
    podeContinuarPagamento(state): boolean {
      if (state.modoRecebimento === 'retirada') return true
      return state.enderecoSelecionadoId != null
    },
    loginPronto(state): boolean {
      return Boolean(state.login?.key?.trim())
    },
  },

  actions: {
    reset() {
      this.id = null
      this.nome = null
      this.logo_url = null
      this.slug = null
      this.canal = null
      this.termos = []
      this.produtos = []
      this.total_produtos = 0
      this.has_more = false
      this.loading = false
      this.loadingMais = false
      this.buscou = false
      this.erro = null
      this.paginaProdutoUnico = null
      this.observacaoProdutoUnico = ''
      this.carrinhoAtual = []
      this.observacaoPedido = ''
      this.modoRecebimento = 'entrega'
      this.enderecos = []
      this.enderecoSelecionadoId = null
      this.enderecosLoading = false
      this.formaPagamento = null
    },

    setCardapio(data: LojaCardapioPublico, slug: string) {
      const ws: LojaWorkspacePublico = data.workspace
      this.id = ws.id
      this.nome = ws.nome
      this.logo_url = ws.logo_url
      this.slug = slug
      const canalAnterior = this.canal?.id
      this.canal = data.canal
      if (canalAnterior !== data.canal.id) {
        this.enderecos = []
        this.enderecoSelecionadoId = null
      }
      this.termos = data.termos
      this.produtos = data.produtos
      this.total_produtos = data.total
      this.has_more = data.has_more
      this.erro = null
      this.hidratarCarrinho(slug)
      this.hidratarLogin(slug)
    },

    appendCardapio(data: LojaCardapioPublico) {
      const termoIds = new Set(this.termos.map((t) => t.id))
      const extraTermos = data.termos.filter((t) => !termoIds.has(t.id))
      if (extraTermos.length) {
        this.termos = [...this.termos, ...extraTermos].sort((a, b) => {
          if (a.ordem !== b.ordem) return a.ordem - b.ordem
          return a.id - b.id
        })
      }

      const visto = new Set(this.produtos.map((p) => `${p.termo_id}-${p.id}`))
      const extraProdutos = data.produtos.filter((p) => !visto.has(`${p.termo_id}-${p.id}`))
      if (extraProdutos.length) {
        this.produtos = [...this.produtos, ...extraProdutos]
      }

      this.total_produtos = data.total
      this.has_more = data.has_more
      if (data.canal) this.canal = data.canal
    },

    async carregarPorSlug(slugRaw: string) {
      const slug = String(slugRaw ?? '').trim().toLowerCase()
      if (slug && this.slug === slug && this.id != null && this.nome != null && this.buscou && !this.erro) {
        this.hidratarCarrinho(slug)
        this.hidratarLogin(slug)
        return true
      }

      this.loading = true
      this.loadingMais = false
      this.erro = null

      if (!slug) {
        this.id = null
        this.nome = null
        this.logo_url = null
        this.slug = null
        this.canal = null
        this.termos = []
        this.produtos = []
        this.total_produtos = 0
        this.has_more = false
        this.loadingMais = false
        this.erro = 'Loja não encontrada.'
        this.buscou = true
        this.paginaProdutoUnico = null
        this.observacaoProdutoUnico = ''
        this.carrinhoAtual = []
        this.observacaoPedido = ''
        this.loading = false
        return false
      }

      try {
        const res = await $fetch<LojaWorkspacePublicoResponse>(
          `/api/public/loja/workspace/${encodeURIComponent(slug)}`,
        )
        this.setCardapio(res.data, slug)
        return true
      } catch (err) {
        this.id = null
        this.nome = null
        this.logo_url = null
        this.slug = slug
        this.canal = null
        this.termos = []
        this.produtos = []
        this.total_produtos = 0
        this.has_more = false
        this.loadingMais = false
        this.paginaProdutoUnico = null
        this.observacaoProdutoUnico = ''
        this.carrinhoAtual = []
        this.observacaoPedido = ''
        this.erro = mensagemErro(err, 'Loja não encontrada.')
        return false
      } finally {
        this.buscou = true
        this.loading = false
      }
    },

    abrirProdutoUnico(produto: LojaProdutoPublico) {
      if (this.paginaProdutoUnico?.id !== produto.id) {
        this.observacaoProdutoUnico = ''
      }
      this.paginaProdutoUnico = { ...produto }
    },

    abrirProdutoUnicoPorId(produtoId: number) {
      if (this.paginaProdutoUnico?.id === produtoId) return true
      const found = this.produtos.find((p) => p.id === produtoId)
      if (!found) return false
      this.observacaoProdutoUnico = ''
      this.paginaProdutoUnico = { ...found }
      return true
    },

    fecharProdutoUnico() {
      this.paginaProdutoUnico = null
      this.observacaoProdutoUnico = ''
    },

    hidratarCarrinho(slugRaw?: string) {
      if (!import.meta.client) return
      const slug = String(slugRaw ?? this.slug ?? '').trim().toLowerCase()
      if (!slug) {
        this.carrinhoAtual = []
        this.observacaoPedido = ''
        return
      }
      const salvo = lerCarrinhoLocal(slug)
      this.carrinhoAtual = salvo.itens
      this.observacaoPedido = salvo.observacaoPedido
    },

    persistirCarrinho() {
      if (!import.meta.client) return
      const slug = String(this.slug ?? '').trim().toLowerCase()
      if (!slug) return
      gravarCarrinhoLocal(slug, this.carrinhoAtual, this.observacaoPedido)
    },

    hidratarLogin(slugRaw?: string) {
      if (!import.meta.client) return
      const slug = String(slugRaw ?? this.slug ?? '').trim().toLowerCase()
      if (!slug) return
      const salvo = lerLoginLocal(slug)
      if (salvo) this.login = salvo
    },

    persistirLogin() {
      if (!import.meta.client) return
      const slug = String(this.slug ?? '').trim().toLowerCase()
      if (!slug) return
      gravarLoginLocal(slug, this.login)
    },

    adicionarAoCarrinho(payload: {
      produto: LojaProdutoPublico
      quantidade: number
      observacao?: string
      precoUnitario: number
    }) {
      const quantidade = Math.max(1, Math.floor(payload.quantidade) || 1)
      const observacao = String(payload.observacao ?? '').trim()
      const chave = chaveItemCarrinho(payload.produto.id, observacao)
      const existente = this.carrinhoAtual.find((item) => item.chave === chave)

      if (existente) {
        existente.quantidade += quantidade
      } else {
        this.carrinhoAtual.push({
          chave,
          produto_id: payload.produto.id,
          nome: payload.produto.nome,
          imagem_url: payload.produto.imagem_url,
          preco_unitario: payload.precoUnitario,
          quantidade,
          observacao,
        })
      }

      this.persistirCarrinho()
    },

    alterarQuantidadeCarrinho(chave: string, quantidade: number) {
      const qtd = Math.floor(quantidade)
      if (qtd < 1) {
        this.removerItemCarrinho(chave)
        return
      }
      const item = this.carrinhoAtual.find((i) => i.chave === chave)
      if (!item) return
      item.quantidade = qtd
      this.persistirCarrinho()
    },

    removerItemCarrinho(chave: string) {
      this.carrinhoAtual = this.carrinhoAtual.filter((i) => i.chave !== chave)
      this.persistirCarrinho()
    },

    limparCarrinho() {
      this.carrinhoAtual = []
      this.observacaoPedido = ''
      this.persistirCarrinho()
    },

    setObservacaoPedido(texto: string) {
      this.observacaoPedido = String(texto ?? '').slice(0, 280)
      this.persistirCarrinho()
    },

    setModoRecebimento(modo: LojaModoRecebimento) {
      this.modoRecebimento = modo
    },

    selecionarEndereco(id: number) {
      this.enderecoSelecionadoId = id
    },

    async carregarEnderecos() {
      const idCanal = this.canal?.id
      const conversaKey = this.login?.key?.trim()
      if (!idCanal || !conversaKey) {
        this.enderecos = []
        this.enderecoSelecionadoId = null
        return false
      }

      if (this.enderecos.length) {
        if (this.enderecoSelecionadoId == null
          || !this.enderecos.some((e) => e.id === this.enderecoSelecionadoId)) {
          const padrao = this.enderecos.find((e) => e.padrao) ?? this.enderecos[0]
          this.enderecoSelecionadoId = padrao?.id ?? null
        }
        return true
      }

      this.enderecosLoading = true
      try {
        const res = await $fetch<LojaEnderecosListaResponse>('/api/public/loja/endereco', {
          query: { id_canal: idCanal, conversa_key: conversaKey },
        })
        this.enderecos = res.data
        const padrao = res.data.find((e) => e.padrao) ?? res.data[0]
        this.enderecoSelecionadoId = padrao?.id ?? null
        return true
      } catch {
        this.enderecos = []
        this.enderecoSelecionadoId = null
        return false
      } finally {
        this.enderecosLoading = false
      }
    },

    async adicionarEndereco(payload: LojaEnderecoCreate) {
      const idCanal = this.canal?.id
      const conversaKey = this.login?.key?.trim()
      if (!idCanal || !conversaKey) {
        throw new Error('Faça login para salvar o endereço.')
      }

      const res = await $fetch<LojaEnderecoItemResponse>('/api/public/loja/endereco', {
        method: 'POST',
        body: {
          id_canal: idCanal,
          conversa_key: conversaKey,
          ...payload,
        },
      })
      const novo = res.data
      if (novo.padrao) {
        this.enderecos = this.enderecos.map((e) => ({ ...e, padrao: false }))
      }
      this.enderecos = [novo, ...this.enderecos.filter((e) => e.id !== novo.id)]
      this.enderecoSelecionadoId = novo.id
      return novo
    },

    async atualizarEndereco(id: number, payload: LojaEnderecoCreate) {
      const idCanal = this.canal?.id
      const conversaKey = this.login?.key?.trim()
      if (!idCanal || !conversaKey) {
        throw new Error('Faça login para editar o endereço.')
      }

      const res = await $fetch<LojaEnderecoItemResponse>(`/api/public/loja/endereco/${id}`, {
        method: 'PATCH',
        body: {
          id_canal: idCanal,
          conversa_key: conversaKey,
          ...payload,
        },
      })
      const atualizado = res.data
      this.enderecos = this.enderecos.map((e) => {
        if (e.id === atualizado.id) return atualizado
        if (atualizado.padrao) return { ...e, padrao: false }
        return e
      })
      return atualizado
    },

    async apagarEndereco(id: number) {
      const idCanal = this.canal?.id
      const conversaKey = this.login?.key?.trim()
      if (!idCanal || !conversaKey) return

      await $fetch(`/api/public/loja/endereco/${id}`, {
        method: 'DELETE',
        query: { id_canal: idCanal, conversa_key: conversaKey },
      })
      this.enderecos = this.enderecos.filter((e) => e.id !== id)
      if (this.enderecoSelecionadoId === id) {
        this.enderecoSelecionadoId = this.enderecos[0]?.id ?? null
      }
    },

    setFormaPagamento(forma: LojaFormaPagamento) {
      this.formaPagamento = forma
    },

    setLogin(dados: LojaLogin) {
      this.login = {
        nome: dados.nome.trim(),
        celular: dados.celular.trim(),
        cpf: dados.cpf.trim(),
        key: dados.key.trim(),
      }
      this.persistirLogin()
    },

    setLoginRascunho(dados: { nome: string; celular: string; cpf: string }) {
      this.login = {
        nome: dados.nome.trim(),
        celular: dados.celular.trim(),
        cpf: dados.cpf.trim(),
        key: '',
      }
    },

    limparLoginCelular() {
      if (!this.login) return
      this.login = {
        ...this.login,
        celular: '',
        key: '',
      }
    },

    async carregarMais() {
      if (!this.slug || !this.has_more || this.loading || this.loadingMais) return false

      this.loadingMais = true
      try {
        const res = await $fetch<LojaWorkspacePublicoResponse>(
          `/api/public/loja/workspace/${encodeURIComponent(this.slug)}`,
          { query: { offset: this.produtos.length } },
        )
        this.appendCardapio(res.data)
        return true
      } catch {
        return false
      } finally {
        this.loadingMais = false
      }
    },
  },
})

const CARRINHO_STORAGE_PREFIX = 'loja-carrinho:'

function chaveCarrinho(slug: string): string {
  return `${CARRINHO_STORAGE_PREFIX}${slug}`
}

function chaveItemCarrinho(produtoId: number, observacao: string): string {
  return `${produtoId}::${observacao.trim().toLowerCase()}`
}

function lerCarrinhoLocal(slug: string): { itens: LojaCarrinhoItem[]; observacaoPedido: string } {
  const vazio = { itens: [] as LojaCarrinhoItem[], observacaoPedido: '' }
  try {
    const raw = localStorage.getItem(chaveCarrinho(slug))
    if (!raw) return vazio
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return {
        itens: parsed
          .map((row) => normalizarItemCarrinho(row))
          .filter((item): item is LojaCarrinhoItem => item != null),
        observacaoPedido: '',
      }
    }
    if (!parsed || typeof parsed !== 'object') return vazio
    const data = parsed as Record<string, unknown>
    const lista = Array.isArray(data.itens) ? data.itens : []
    return {
      itens: lista
        .map((row) => normalizarItemCarrinho(row))
        .filter((item): item is LojaCarrinhoItem => item != null),
      observacaoPedido: String(data.observacaoPedido ?? '').slice(0, 280),
    }
  } catch {
    return vazio
  }
}

const LOGIN_STORAGE_PREFIX = 'loja-login:'

function chaveLogin(slug: string): string {
  return `${LOGIN_STORAGE_PREFIX}${slug}`
}

function lerLoginLocal(slug: string): LojaLogin | null {
  try {
    const raw = localStorage.getItem(chaveLogin(slug))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const r = parsed as Record<string, unknown>
    const nome = String(r.nome ?? '').trim()
    const celular = String(r.celular ?? '').trim()
    const cpf = String(r.cpf ?? '').trim()
    const key = String(r.key ?? '').trim()
    if (!nome || !celular || !cpf || !key) return null
    return { nome, celular, cpf, key }
  } catch {
    return null
  }
}

function gravarLoginLocal(slug: string, login: LojaLogin | null) {
  try {
    const key = String(login?.key ?? '').trim()
    if (!login || !key) {
      localStorage.removeItem(chaveLogin(slug))
      return
    }
    localStorage.setItem(
      chaveLogin(slug),
      JSON.stringify({
        nome: login.nome.trim(),
        celular: login.celular.trim(),
        cpf: login.cpf.trim(),
        key,
      }),
    )
  } catch {
    // quota / modo privado
  }
}

function gravarCarrinhoLocal(slug: string, itens: LojaCarrinhoItem[], observacaoPedido: string) {
  try {
    localStorage.setItem(
      chaveCarrinho(slug),
      JSON.stringify({ itens, observacaoPedido }),
    )
  } catch {
    // quota / modo privado
  }
}

function normalizarItemCarrinho(row: unknown): LojaCarrinhoItem | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  const produtoId = Number(r.produto_id)
  const preco = Number(r.preco_unitario)
  const quantidade = Math.floor(Number(r.quantidade))
  const nome = String(r.nome ?? '').trim()
  if (!Number.isFinite(produtoId) || produtoId < 1) return null
  if (!Number.isFinite(preco) || preco < 0) return null
  if (!Number.isFinite(quantidade) || quantidade < 1) return null
  if (!nome) return null
  const observacao = String(r.observacao ?? '').trim()
  return {
    chave: typeof r.chave === 'string' && r.chave ? r.chave : chaveItemCarrinho(produtoId, observacao),
    produto_id: produtoId,
    nome,
    imagem_url: typeof r.imagem_url === 'string' && r.imagem_url.trim() ? r.imagem_url : null,
    preco_unitario: preco,
    quantidade,
    observacao,
  }
}

function mensagemErro(err: unknown, fallback: string): string {
  if (!err || typeof err !== 'object') return fallback
  const e = err as Record<string, unknown>
  const data = e.data
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (typeof d.statusMessage === 'string' && d.statusMessage.trim()) return d.statusMessage
    if (typeof d.message === 'string' && d.message.trim()) return d.message
  }
  if (typeof e.statusMessage === 'string' && e.statusMessage.trim()) return e.statusMessage
  if (typeof e.message === 'string' && e.message.trim()) return e.message
  return fallback
}
