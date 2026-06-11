/** Linha da tabela de variações (UI; persistência na página/API virá depois). */
export type CriarProdutoVariacaoLinha = {
  id: string
  rotulo: string
  sku: string
  preco: string
  disponivel: boolean
  /** URL de pré-visualização opcional (ex.: cor Preto). */
  imagemUrl?: string | null
}

export type CriarProdutoTipoImagensVariacao = 'iguais' | 'diferentes'
