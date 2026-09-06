import type { H3Event } from 'h3'
import type { VectorSearchResult } from '#shared/types/vectorStore'
import { loadWorkspaceOpenAiCredenciais } from '../agente/loadCanalCredenciais'
import { searchSimilar } from './documentsVectorStore'
import { createEmbedding } from './openaiEmbeddings'
import type { BuscarParams } from './parseBuscarParams'

export async function executeVectorSearch(
  event: H3Event,
  params: BuscarParams,
): Promise<VectorSearchResult> {
  const credenciais = await loadWorkspaceOpenAiCredenciais(event, params.workspaceId)
  const queryEmbedding = await createEmbedding(
    credenciais.api_key,
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
