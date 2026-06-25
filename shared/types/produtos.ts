/** Imagem agregada de `produto_imagens` (view de listagem). */
export type ProdutoImagemItem = {
  id?: number
  produto_id?: number
  /** Alias UI; no banco a coluna é `imagem_url`. */
  url?: string | null
  imagem_url?: string | null
  ordem?: number | null
  workspace_id?: number
  created_at?: string
  [key: string]: unknown
}

/** Resposta de `POST /api/produtos/fotosblackblaze/upload` e `adicionar-url`. */
export type ProdutosFotosUploadResponse = {
  inseridas: number
  data: ProdutoImagemItem[]
}

/** Resposta de `POST /api/produtos/fotosblackblaze/excluir`. */
export type ProdutosFotosExcluirResponse = {
  removidos: number
  ids: number[]
}

/** Resposta de `POST /api/produtos/fotosblackblaze/reordenar`. */
export type ProdutosFotosReordenarResponse = {
  atualizadas: number
  data: ProdutoImagemItem[]
}

/** Onde o produto está listado (`GET /api/produtos/buscar` ou rascunho em massa). */
export type ProdutoSelecaoContexto = 'lista' | 'rascunho'

/**
 * Referência a um produto na seleção Pinia (checkboxes, modais, edição em lote, etc.).
 * Não duplica os dados do produto — só identifica a linha no contexto correto.
 */
export type ProdutoSelecionadoRef = {
  produtoId: number
  nome: string
  contexto: ProdutoSelecaoContexto
  /** Preenchido quando a linha é uma variação na listagem. */
  parentId: number | null
  tipo: 'pai' | 'variacao'
}

/** Campos escalares comuns a pai e variação. */
export type ProdutoWorkspaceCampos = {
  /** PK da tabela. */
  id: number
  codigo: number | null
  nome: string
  categoria_id: number | null
  /** Nome da categoria (embed ou json `categoria` da view). */
  categoria_nome: string | null
  sku: string | null
  unidade_venda: string | null
  marca: string | null
  preco: number
  preco_custo: number
  preco_promocional: number | null
  preco_prazo: number | null
  peso_kg: number | null
  estoque: number | null
  infos_relevantes: string | null
  imagem_url: string | null
  descricao: string | null
  codigo_ncm: string | null
  /** Texto do termo (para busca); vem da view como `termos_pesquisa_busca`. */
  termos_pesquisa_busca?: string | null
  /** Termo de pesquisa único (0 ou 1 item; nome espelhado de `produtos_workspace.termos_pesquisa`). */
  termos_pesquisa: ProdutoTermoPesquisaItem[]
  codigo_barras_ean: string | null
  largura: number
  altura: number
  comprimento: number
  status: boolean
  parent_id: number | null
  atributos: Record<string, unknown> | null
  imagens: ProdutoImagemItem[]
}

/** Variação filha (`parent_id` preenchido). */
export type ProdutoVariacaoItem = ProdutoWorkspaceCampos & {
  parent_id: number
}

/**
 * Produto pai retornado por `GET /api/produtos/buscar`
 * (`view_produtos_com_variacoes`, `parent_id` sempre null).
 */
export type ProdutoWorkspaceItem = ProdutoWorkspaceCampos & {
  parent_id: null
  tem_variacoes: boolean
  variacoes: ProdutoVariacaoItem[]
}

/** Corpo parcial para `PATCH /api/produtos/atualizar` (`patch`). */
export type ProdutoWorkspacePatch = {
  nome?: string
  codigo?: number | null
  sku?: string | null
  unidade_venda?: string | null
  marca?: string | null
  preco?: number
  preco_custo?: number
  preco_promocional?: number | null
  preco_prazo?: number | null
  peso_kg?: number | null
  estoque?: number | null
  infos_relevantes?: string | null
  imagem_url?: string | null
  codigo_ncm?: string | null
  /** Id do termo no catálogo (0 ou 1 elemento; grava `nome` em `produtos_workspace.termos_pesquisa`). */
  termos_pesquisa_ids?: number[]
  codigo_barras_ean?: string | null
  largura?: number
  altura?: number
  comprimento?: number
  status?: boolean
  /** Nome da categoria (resolve para `categoria_id`); vazio remove a categoria. */
  categoria?: string | null
  categoria_id?: number | null
}

/** Resposta de `PATCH /api/produtos/atualizar`. */
export type ProdutoAtualizarResponse = {
  data: ProdutoWorkspaceItem
}

/** Resposta paginada de `GET /api/produtos/buscar`. */
export type ProdutosBuscaResponse = {
  data: ProdutoWorkspaceItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

/** Resposta de `POST /api/produtos/enviar-para-ia/excluir`. */
export type ProdutosExcluirResponse = {
  removidos: number
  /** Ids efetivamente apagados (podem ser menos que os pedidos se algum id não existia). */
  ids: number[]
}

/** Linha para `POST /api/produtos/criar-em-massa`. */
export type ProdutoCriarEmMassaLinha = {
  nome: string
  sku?: string | null
  unidade_venda?: string | null
  marca?: string | null
  preco?: number
  preco_custo?: number
  preco_promocional?: number | null
  preco_prazo?: number | null
  peso_kg?: number | null
  estoque?: number | null
  imagem_url?: string | null
  infos_relevantes?: string | null
  status?: boolean
  categoria_id?: number | null
  codigo_ncm?: string | null
  termo_pesquisa?: number | null
  codigo_barras_ean?: string | null
  largura?: number
  altura?: number
  comprimento?: number
  /** Quando preenchido, cria variação filha deste produto pai. */
  parent_id?: number | null
}

/** Resposta de `POST /api/produtos/criar-em-massa`. */
export type ProdutosCriarEmMassaResponse = {
  inseridos: number
}

/** Linha de `public.produto_termo_de_pesquisa` (lista / multi-select). */
export type ProdutoTermoPesquisaItem = {
  id: number
  nome: string
}

/** Resposta de `GET /api/produtos/termos-de-pesquisa`. */
export type ProdutosTermosPesquisaListaResponse = {
  data: ProdutoTermoPesquisaItem[]
}

/** Resposta de `POST /api/produtos/termos-de-pesquisa`. */
export type ProdutosTermoPesquisaCriarResponse = {
  data: ProdutoTermoPesquisaItem
  ja_existia: boolean
}

/** Resposta de `PATCH /api/produtos/termos-de-pesquisa/:id`. */
export type ProdutosTermoPesquisaAtualizarResponse = {
  data: ProdutoTermoPesquisaItem
}

/** Resposta de `DELETE /api/produtos/termos-de-pesquisa/:id`. */
export type ProdutosTermoPesquisaEliminarResponse = {
  ok: true
}

/** Linha de `public.produto_categorias` (lista / typeahead). */
export type ProdutoCategoriaItem = {
  id: number
  nome: string
  ativo: boolean
}

/** Resposta de `GET /api/produtos/categorias`. */
export type ProdutosCategoriasListaResponse = {
  data: ProdutoCategoriaItem[]
}

/** Resposta de `POST /api/produtos/categorias` (criar ou devolver existente). */
export type ProdutosCategoriaCriarResponse = {
  data: ProdutoCategoriaItem
  /** `true` se já existia linha com o mesmo nome (comparação sem distinção de maiúsculas). */
  ja_existia: boolean
}

/** Resposta de `PATCH /api/produtos/categorias/:id`. */
export type ProdutosCategoriaAtualizarResponse = {
  data: ProdutoCategoriaItem
}

/** Resposta de `DELETE /api/produtos/categorias/:id`. */
export type ProdutosCategoriaEliminarResponse = {
  ok: true
}

/**
 * Uma linha a inserir via `POST /api/produtos/importar` (sem `workspace_id` no corpo;
 * o servidor define `workspace_id` e gera `codigo` sequencial por workspace).
 *
 * Categoria: no máximo uma por produto (`categoria_id` no registro). Use `categoria_id` quando já conhece o id
 * (ex.: modal Novo); use `categoria` (nome, um único valor) quando o valor vem da planilha — o servidor resolve
 * para `categoria_id` no workspace. Vários nomes na mesma célula (`;` `,` `|`) são reduzidos ao primeiro.
 */
export type ProdutoImportarLinha = {
  nome: string
  categoria_id?: number | null
  categoria?: string | null
  sku?: string | null
  unidade_venda?: string | null
  marca?: string | null
  preco?: number
  preco_prazo?: number | null
  peso_kg?: number | null
  estoque?: number | null
  imagem_url?: string | null
  infos_relevantes?: string | null
  status?: boolean
  /** Texto integral da célula (um termo por produto); servidor cria no catálogo e salva o ID. */
  termos_pesquisa?: string | null
}

/** Resposta de um lote `POST /api/produtos/importar`. */
export type ProdutosImportarLoteResponse = {
  inseridos: number
}
