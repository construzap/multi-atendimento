import type { H3Event } from 'h3'
import type { BuscarProdutosResponse } from '#shared/types/vectorStore'
import { searchSimilar } from './documentsVectorStore'
import { createEmbedding } from './openaiEmbeddings'
import type { BuscarParams } from './parseBuscarParams'

export async function executeVectorSearch(
  event: H3Event,
  params: BuscarParams,
): Promise<BuscarProdutosResponse> {
  const config = useRuntimeConfig(event)
  const queryEmbedding = await createEmbedding(
    String(config.openaiApiKey ?? ''),
    params.query,
    event,
  )

  const hits = await searchSimilar(
    event,
    { workspaceId: params.workspaceId, termosPesquisa: params.termosPesquisa },
    queryEmbedding,
    params.limit,
  )

  return {
    ok: true,
    query: params.query,
    workspace_id: String(params.workspaceId),
    termos_pesquisa: params.termosPesquisa,
    /** @deprecated use workspace_id */
    empresa_id: String(params.workspaceId),
    /** @deprecated use termos_pesquisa */
    categorias: params.termosPesquisa,
    count: hits.length,
    hits,
  }
}
