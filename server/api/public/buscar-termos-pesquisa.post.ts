import { readBody } from 'h3'
import type { BuscarTermosResponse } from '#shared/types/vectorStore'
import { executeTermoVectorSearch } from '../../utils/enviarParaIa/executeTermoVectorSearch'
import { parseBuscarTermosBody } from '../../utils/enviarParaIa/parseBuscarTermosParams'
import { requireVectorSearchApiKey } from '../../utils/enviarParaIa/requireVectorSearchApiKey'

/**
 * POST /api/public/buscar-termos-pesquisa
 *
 * Busca semântica na vector store de termos de pesquisa (integrações n8n, etc.).
 *
 * Auth: Authorization: Bearer <NUXT_VECTOR_SEARCH_API_KEY>
 *    ou header x-api-key: <NUXT_VECTOR_SEARCH_API_KEY>
 *
 * Body JSON:
 *   {
 *     "query": "cimento",
 *     "workspace_id": "4",
 *     "limit": 10,
 *     "metadata": { "termo_id": "12", "nome": "CIMENTO" }
 *   }
 *
 * Filtros opcionais de metadata (todas as chaves devem bater):
 *   - objeto "metadata": { "termo_id": "...", "nome": "..." }
 *   - ou campos soltos no body: "termo_id", "nome"
 *
 * Compatível com empresa_id no lugar de workspace_id.
 */
export default defineEventHandler(async (event): Promise<BuscarTermosResponse> => {
  requireVectorSearchApiKey(event)

  const body = await readBody<Record<string, unknown>>(event)
  const params = parseBuscarTermosBody(body)

  const result = await executeTermoVectorSearch(event, params)

  return {
    ...result,
    hits: result.hits.map(({ content, metadata }) => ({ content, metadata })),
  }
})
