/** IDs dos campos da tabela IA (alinhados a `produtos_workspace`). */
export type CampoIaProdutoId =
  | 'nome'
  | 'categoria'
  | 'termos_pesquisa'
  | 'sku'
  | 'unidade_venda'
  | 'marca'
  | 'preco'
  | 'preco_prazo'
  | 'peso_kg'
  | 'estoque'
  | 'imagem_url'
  | 'infos_relevantes'
  | 'status'

export const CAMPOS_TABELA_IA_PRODUTO: { id: CampoIaProdutoId; label: string }[] = [
  { id: 'nome', label: 'Nome' },
  { id: 'categoria', label: 'Categoria' },
  { id: 'termos_pesquisa', label: 'Termos pesquisa' },
  { id: 'sku', label: 'SKU' },
  { id: 'unidade_venda', label: 'Unidade de venda' },
  { id: 'marca', label: 'Marca' },
  { id: 'preco', label: 'Preço' },
  { id: 'preco_prazo', label: 'Preço a prazo' },
  { id: 'peso_kg', label: 'Peso (kg)' },
  { id: 'estoque', label: 'Estoque' },
  { id: 'imagem_url', label: 'URL da imagem' },
  { id: 'infos_relevantes', label: 'Informações relevantes' },
  { id: 'status', label: 'Status (ativo/inativo)' },
]
