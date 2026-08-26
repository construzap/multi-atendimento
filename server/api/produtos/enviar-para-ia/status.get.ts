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
import {
  countOrphanTermoDocuments,
  countTermosByWorkspace,
  findTermoHashesByWorkspace,
} from '../../../utils/enviarParaIa/termosPesquisa/documentsTermosVectorStore'
import {
  countTermosIndexaveis,
  computeTermoSyncStatus,
} from '../../../utils/enviarParaIa/termosPesquisa/termosIndexaveis'

/** GET /api/produtos/enviar-para-ia/status?workspace_id= */
export default defineEventHandler(async (event): Promise<VectorStoreStatus> => {
  const userId = await requireAuthUserId(event)
  const q = getQuery(event)
  const workspaceId = parseWorkspaceId(q.workspace_id)

  await checkWorkspace(event, workspaceId, userId)

  const [
    total_produtos,
    total_documentos,
    produtoHashes,
    total_termos,
    total_documentos_termos,
    termoHashes,
  ] = await Promise.all([
    countProdutosIndexaveis(event, workspaceId),
    countByWorkspace(event, workspaceId),
    findHashesByWorkspace(event, workspaceId),
    countTermosIndexaveis(event, workspaceId),
    countTermosByWorkspace(event, workspaceId),
    findTermoHashesByWorkspace(event, workspaceId),
  ])

  const { activeProdutoIds, sincronizados, pendentes } = await computeIndexableProdutoSyncStatus(
    event,
    workspaceId,
    produtoHashes,
  )

  const {
    activeTermoIds,
    sincronizados: termos_sincronizados,
    pendentes: termos_pendentes,
  } = await computeTermoSyncStatus(event, workspaceId, termoHashes)

  const [orfaos, termos_orfaos] = await Promise.all([
    countOrphanDocuments(event, workspaceId, activeProdutoIds),
    countOrphanTermoDocuments(event, workspaceId, activeTermoIds),
  ])

  return {
    total_produtos,
    total_documentos,
    sincronizados,
    orfaos,
    pendentes,
    total_termos,
    total_documentos_termos,
    termos_sincronizados,
    termos_orfaos,
    termos_pendentes,
    total_indexados: total_documentos,
  }
})
