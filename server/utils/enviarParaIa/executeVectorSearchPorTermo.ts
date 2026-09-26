import { createError } from 'h3'
import type { H3Event } from 'h3'
import type { VectorSearchResult } from '#shared/types/vectorStore'
import { loadWorkspaceOpenAiCredenciais } from '../agente/loadCanalCredenciais'
import { searchSimilarPorTermo } from './documentsVectorStorePorTermo'
import { createEmbedding } from './openaiEmbeddings'
import type { BuscarParams } from './parseBuscarParams'

export async function executeVectorSearchPorTermo(
  event: H3Event,
  params: BuscarParams,
): Promise<VectorSearchResult> {
  const termosPesquisa = params.termosPesquisa?.trim() || ''
  if (!termosPesquisa) {
    throw createError({
      statusCode: 400,
      statusMessage: 'termos_pesquisa é obrigatório para filtrar-produtos.',
    })
  }

  const credenciais = await loadWorkspaceOpenAiCredenciais(event, params.workspaceId)
  const queryEmbedding = await createEmbedding(
    credenciais.api_key,
    params.query,
    event,
    params.workspaceId,
  )

  const hits = await searchSimilarPorTermo(
    event,
    { workspaceId: params.workspaceId, termosPesquisa },
    queryEmbedding,
    params.limit,
  )

  return {
    ok: true,
    query: params.query,
    workspace_id: String(params.workspaceId),
    termos_pesquisa: termosPesquisa,
    empresa_id: String(params.workspaceId),
    categorias: termosPesquisa,
    count: hits.length,
    hits,
  }
}
