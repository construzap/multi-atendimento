import { getQuery } from 'h3'
import type { VectorStoreStatus } from '#shared/types/vectorStore'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { requireAuthUserId } from '../../../utils/requireAuthUserId'
import {
  countByWorkspace,
  countOrphanDocuments,
  findHashesByWorkspace,
} from '../../../utils/enviarParaIa/documentsVectorStore'
import { parseWorkspaceId } from '../../../utils/enviarParaIa/parseWorkspaceId'
import {
  countProdutosIndexaveis,
  computeIndexableProdutoSyncStatus,
} from '../../../utils/enviarParaIa/produtosIndexaveis'

/** GET /api/produtos/enviar-para-ia/status?workspace_id= */
export default defineEventHandler(async (event): Promise<VectorStoreStatus> => {
  const userId = await requireAuthUserId(event)
  const q = getQuery(event)
  const workspaceId = parseWorkspaceId(q.workspace_id)

  await checkWorkspace(event, workspaceId, userId)

  const [total_produtos, total_documentos, hashes] = await Promise.all([
    countProdutosIndexaveis(event, workspaceId),
    countByWorkspace(event, workspaceId),
    findHashesByWorkspace(event, workspaceId),
  ])

  const { activeCodigos, sincronizados, pendentes } = await computeIndexableProdutoSyncStatus(
    event,
    workspaceId,
    hashes,
  )

  const orfaos = await countOrphanDocuments(event, workspaceId, activeCodigos)

  return {
    total_produtos,
    total_documentos,
    sincronizados,
    orfaos,
    pendentes,
    total_indexados: total_documentos,
  }
})
