import { readBody } from 'h3'
import type { SyncChunkResult } from '#shared/types/vectorStore'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { requireAuthUserId } from '../../../utils/requireAuthUserId'
import {
  deleteByCodigo,
  findHashesByWorkspace,
  insertDocument,
} from '../../../utils/enviarParaIa/documentsVectorStore'
import { createEmbeddings } from '../../../utils/enviarParaIa/openaiEmbeddings'
import { parseWorkspaceId } from '../../../utils/enviarParaIa/parseWorkspaceId'
import { buildProdutoEmbeddingPayload } from '../../../utils/enviarParaIa/produtoEmbeddingText'
import {
  countProdutosIndexaveis,
  fetchProdutosIndexaveisChunk,
} from '../../../utils/enviarParaIa/produtosIndexaveis'

type Body = {
  workspace_id?: unknown
  force?: unknown
  offset?: unknown
  limit?: unknown
}

const DEFAULT_CHUNK = 50

/** POST /api/produtos/enviar-para-ia/sync — processa um chunk de produtos. */
export default defineEventHandler(async (event): Promise<SyncChunkResult> => {
  const userId = await requireAuthUserId(event)
  const body = await readBody<Body>(event)
  const workspaceId = parseWorkspaceId(body?.workspace_id)
  const force = body?.force === true || body?.force === 'true'

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

  const config = useRuntimeConfig(event)
  const total = await countProdutosIndexaveis(event, workspaceId)
  const rows = await fetchProdutosIndexaveisChunk(event, workspaceId, offset, limit)

  const existingHashes = force ? new Map<string, string>() : await findHashesByWorkspace(event, workspaceId)

  const toEmbed: ReturnType<typeof buildProdutoEmbeddingPayload>[] = []
  let skipped = 0

  for (const row of rows) {
    const payload = buildProdutoEmbeddingPayload(row, workspaceId)
    if (!payload) continue

    const prev = existingHashes.get(payload.codigo)
    if (!force && prev === payload.contentHash) {
      skipped++
      continue
    }

    toEmbed.push(payload)
  }

  const errors: string[] = []
  let embedded = 0

  if (toEmbed.length) {
    try {
      const embeddings = await createEmbeddings(
        String(config.openaiApiKey ?? ''),
        toEmbed.map((p) => p!.content),
        event,
      )

      for (let i = 0; i < toEmbed.length; i++) {
        const payload = toEmbed[i]!
        const embedding = embeddings[i]
        if (!embedding) {
          errors.push(`Produto ${payload.produtoId}: embedding vazio`)
          continue
        }

        try {
          if (payload.codigo) {
            await deleteByCodigo(event, workspaceId, payload.codigo)
          }
          await insertDocument(event, payload.content, payload.metadata, embedding)
          embedded++
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          errors.push(`Produto ${payload.produtoId}: ${msg}`)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(msg)
    }
  }

  const processed = offset + rows.length
  const done = processed >= total

  return {
    total,
    processed,
    embedded,
    skipped,
    errors,
    done,
    nextOffset: done ? null : processed,
  }
})
