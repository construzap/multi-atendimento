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
  /** Se o agente pode enviar foto deste produto na conversa (default true). */
  envia_foto: boolean
}

export type ProdutoEmbeddingPayload = {
  produtoId: number
  codigo: string
  content: string
  metadata: DocumentMetadata
  contentHash: string
}

/** Metadata persistido na vector store de termos de pesquisa. */
export type TermoDocumentMetadata = {
  loc: {
    lines: {
      from: number
      to: number
    }
  }
  source: 'blob'
  blobType: 'text/plain'
  workspace_id: string
  content_hash: string
  termo_id: string
  nome: string
}

export type TermoEmbeddingPayload = {
  termoId: number
  content: string
  metadata: TermoDocumentMetadata
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
  /** Termos de pesquisa em uso (produtos/variações ativos). */
  total_termos: number
  total_documentos_termos: number
  termos_sincronizados: number
  termos_orfaos: number
  termos_pendentes: number
  /** @deprecated use total_documentos */
  total_indexados?: number
}

export type SearchHit = {
  id: string
  content: string
  metadata: DocumentMetadata | Record<string, unknown>
  similarity: number
}

/** Item de hit na resposta pública (sem id interno nem score). */
export type BuscarProdutosPublicHit = Pick<SearchHit, 'content' | 'metadata'>

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

/** Resultado interno da busca semântica (com id e similarity). */
export type VectorSearchResult = {
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

/** Resposta do endpoint público POST /api/public/buscar-produtos */
export type BuscarProdutosResponse = Omit<VectorSearchResult, 'hits'> & {
  hits: BuscarProdutosPublicHit[]
}

export type TermoSearchHit = {
  id: string
  content: string
  metadata: TermoDocumentMetadata | Record<string, unknown>
  similarity: number
}

/** Item de hit na resposta pública de termos (sem id interno nem score). */
export type BuscarTermosPublicHit = Pick<TermoSearchHit, 'content' | 'metadata'>

export type TermoVectorStoreSearchFilters = {
  workspaceId: number
  /** Filtros opcionais: todas as chaves devem bater com metadata (ex.: termo_id, nome). */
  metadata?: Record<string, string> | null
}

/** Resultado interno da busca semântica de termos (com id e similarity). */
export type TermoVectorSearchResult = {
  ok: true
  query: string
  workspace_id: string
  metadata_filters: Record<string, string> | null
  count: number
  hits: TermoSearchHit[]
}

/** Resposta do endpoint público POST /api/public/buscar-termos-pesquisa */
export type BuscarTermosResponse = Omit<TermoVectorSearchResult, 'hits'> & {
  hits: BuscarTermosPublicHit[]
}
