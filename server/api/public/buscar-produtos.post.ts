import { readBody } from 'h3'
import type { BuscarProdutosResponse } from '#shared/types/vectorStore'
import { executeVectorSearch } from '../../utils/enviarParaIa/executeVectorSearch'
import { parseBuscarBody } from '../../utils/enviarParaIa/parseBuscarParams'
import { requireVectorSearchApiKey } from '../../utils/enviarParaIa/requireVectorSearchApiKey'

/**
 * POST /api/public/buscar-produtos
 *
 * Busca semântica na vector store para integrações externas (n8n, Postman, etc.).
 *
 * Auth: Authorization: Bearer <NUXT_VECTOR_SEARCH_API_KEY>
 *    ou header x-api-key: <NUXT_VECTOR_SEARCH_API_KEY>
 *
 * Body JSON:
 *   { "query": "cimento 50kg", "workspace_id": "4", "termos_pesquisa": "cimento", "limit": 10 }
 *
 * Compatível com nomes antigos: empresa_id, categorias.
 */
export default defineEventHandler(async (event): Promise<BuscarProdutosResponse> => {
  requireVectorSearchApiKey(event)

  const body = await readBody<Record<string, unknown>>(event)
  const params = parseBuscarBody(body)

  return executeVectorSearch(event, params)
})
