import { readBody } from 'h3'
import type { SearchHit } from '#shared/types/vectorStore'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { requireAuthUserId } from '../../../utils/requireAuthUserId'
import { executeVectorSearch } from '../../../utils/enviarParaIa/executeVectorSearch'
import { parseBuscarBody } from '../../../utils/enviarParaIa/parseBuscarParams'
import { parseWorkspaceId } from '../../../utils/enviarParaIa/parseWorkspaceId'

type Body = Record<string, unknown>

type BuscarResponse = {
  hits: SearchHit[]
}

/** POST /api/produtos/enviar-para-ia/buscar — busca semântica (UI autenticada). */
export default defineEventHandler(async (event): Promise<BuscarResponse> => {
  const userId = await requireAuthUserId(event)
  const body = await readBody<Body>(event)
  const workspaceId = parseWorkspaceId(body?.workspace_id)

  const params = parseBuscarBody(body, { workspaceFallback: workspaceId })

  await checkWorkspace(event, workspaceId, userId)
  await checkWorkspace(event, params.workspaceId, userId)

  const result = await executeVectorSearch(event, params)
  return { hits: result.hits }
})


