import { readBody } from 'h3'
import type { SyncCleanupChunkResult } from '#shared/types/vectorStore'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { requireAuthUserId } from '../../../utils/requireAuthUserId'
import {
  countByWorkspace,
  deleteDocumentById,
  listVectorDocumentsChunk,
} from '../../../utils/enviarParaIa/documentsVectorStore'
import { parseWorkspaceId } from '../../../utils/enviarParaIa/parseWorkspaceId'
import { fetchIndexableProdutoIdKeys } from '../../../utils/enviarParaIa/produtosIndexaveis'

type Body = {
  workspace_id?: unknown
  offset?: unknown
  limit?: unknown
}

const DEFAULT_CHUNK = 100

/** POST /api/produtos/enviar-para-ia/sync-cleanup — remove órfãos da vector store (chunk). */
export default defineEventHandler(async (event): Promise<SyncCleanupChunkResult> => {
  const userId = await requireAuthUserId(event)
  const body = await readBody<Body>(event)
  const workspaceId = parseWorkspaceId(body?.workspace_id)

  const offsetRaw = body?.offset
  const offset =
    typeof offsetRaw === 'number' && Number.isInteger(offsetRaw) && offsetRaw >= 0
      ? offsetRaw
      : Number.parseInt(String(offsetRaw ?? '0'), 10) || 0

  const limitRaw = body?.limit
  const limit =
    typeof limitRaw === 'number' && Number.isInteger(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, 100)
      : DEFAULT_CHUNK

  await checkWorkspace(event, workspaceId, userId)

  const [total, activeProdutoIds, docs] = await Promise.all([
    countByWorkspace(event, workspaceId),
    fetchIndexableProdutoIdKeys(event, workspaceId),
    listVectorDocumentsChunk(event, workspaceId, offset, limit),
  ])

  const errors: string[] = []
  let removed = 0

  for (const doc of docs) {
    const isOrphan = doc.produtoId == null || !activeProdutoIds.has(doc.produtoId)
    if (!isOrphan) continue

    try {
      await deleteDocumentById(event, doc.id)
      removed++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`Documento ${doc.id}: ${msg}`)
    }
  }

  let nextOffset: number | null
  let done: boolean

  if (total === 0 || docs.length === 0) {
    done = true
    nextOffset = null
  } else if (removed > 0) {
    // Remoções deslocam a lista — revarre a partir do início
    done = false
    nextOffset = 0
  } else if (docs.length < limit) {
    done = true
    nextOffset = null
  } else {
    done = false
    nextOffset = offset + docs.length
  }

  const processed = removed > 0 ? offset : offset + docs.length

  return {
    total,
    processed: Math.min(processed, total),
    removed,
    errors,
    done,
    nextOffset,
  }
})
