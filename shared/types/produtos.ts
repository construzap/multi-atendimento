/**
 * Linha de `public.produtos_workspace` retornada por
 * `GET /api/produtos/buscar` (subset de colunas + nome da categoria via FK).
 */
export type ProdutoWorkspaceItem = {
  /** PK da tabela. */
  id: number
  codigo: number | null
  nome: string
  categoria_id: number | null
  /** `produto_categorias.nome` quando `categoria_id` está preenchido. */
  categoria_nome: string | null
  sku: string | null
  unidade_venda: string | null
  marca: string | null
  preco: number
  preco_prazo: number | null
  peso_kg: number | null
  infos_relevantes: string | null
  imagem_url: string | null
  status: boolean
}

/** Corpo parcial para `PATCH /api/produtos/atualizar` (`patch`). */
export type ProdutoWorkspacePatch = {
  nome?: string
  codigo?: number | null
  sku?: string | null
  unidade_venda?: string | null
  marca?: string | null
  preco?: number
  preco_prazo?: number | null
  peso_kg?: number | null
  infos_relevantes?: string | null
  imagem_url?: string | null
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

/** Resposta de `POST /api/produtos/excluir`. */
export type ProdutosExcluirResponse = {
  removidos: number
  /** Ids efetivamente apagados (podem ser menos que os pedidos se algum id não existia). */
  ids: number[]
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
}

/** Resposta de um lote `POST /api/produtos/importar`. */
export type ProdutosImportarLoteResponse = {
  inseridos: number
}
