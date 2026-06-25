/** Metadata persistido na vector store (formato LangChain-like). */
export type DocumentMetadata = {
  loc: {
    lines: {
      from: number
      to: number
    }
  }
  source: 'blob'
  blobType: 'text/plain'
  termos_pesquisa: string
  workspace_id: string
  content_hash: string
  /** URLs de `produto_imagens` (view `imagens`), ordenadas por `ordem`. */
  imagens_urls: string[]
}

export type ProdutoEmbeddingPayload = {
  produtoId: number
  codigo: string
  content: string
  metadata: DocumentMetadata
  contentHash: string
}

export type SyncChunkResult = {
  total: number
  processed: number
  embedded: number
  skipped: number
  errors: string[]
  done: boolean
  nextOffset: number | null
}

export type SyncCleanupChunkResult = {
  total: number
  processed: number
  removed: number
  errors: string[]
  done: boolean
  nextOffset: number | null
}

export type VectorStoreStatus = {
  total_produtos: number
  total_documentos: number
  sincronizados: number
  orfaos: number
  pendentes: number
  /** @deprecated use total_documentos */
  total_indexados?: number
}

export type SearchHit = {
  id: string
  content: string
  metadata: DocumentMetadata | Record<string, unknown>
  similarity: number
}

export type VectorStoreSearchFilters = {
  workspaceId: number
  termosPesquisa?: string | null
}

export type SearchFormPayload = {
  query: string
  limit: number
  empresa_id: string
  categorias: string
}

/** Resposta do endpoint público POST /api/public/buscar-produtos */
export type BuscarProdutosResponse = {
  ok: true
  query: string
  workspace_id: string
  termos_pesquisa: string | null
  count: number
  hits: SearchHit[]
  /** @deprecated use workspace_id */
  empresa_id?: string
  /** @deprecated use termos_pesquisa */
  categorias?: string | null
}
