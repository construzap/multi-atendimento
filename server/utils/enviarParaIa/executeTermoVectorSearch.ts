import type { H3Event } from 'h3'
import type { TermoVectorSearchResult } from '#shared/types/vectorStore'
import { createEmbedding } from './openaiEmbeddings'
import type { BuscarTermosParams } from './parseBuscarTermosParams'
import { searchTermosSimilar } from './termosPesquisa/documentsTermosVectorStore'

export async function executeTermoVectorSearch(
  event: H3Event,
  params: BuscarTermosParams,
): Promise<TermoVectorSearchResult> {
  const config = useRuntimeConfig(event)
  const queryEmbedding = await createEmbedding(
    String(config.openaiApiKey ?? ''),
    params.query,
    event,
  )

  const hits = await searchTermosSimilar(
    event,
    {
      workspaceId: params.workspaceId,
      metadata: params.metadataFilters,
    },
    queryEmbedding,
    params.limit,
  )

  return {
    ok: true,
    query: params.query,
    workspace_id: String(params.workspaceId),
    metadata_filters: params.metadataFilters,
    count: hits.length,
    hits,
  }
}
