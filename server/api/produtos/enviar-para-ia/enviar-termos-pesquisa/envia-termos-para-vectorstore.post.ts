import { readBody } from 'h3'
import type { SyncChunkResult } from '#shared/types/vectorStore'
import { checkWorkspace } from '../../../../utils/checkWorkspace'
import { requireAuthUserId } from '../../../../utils/requireAuthUserId'
import { createEmbeddings } from '../../../../utils/enviarParaIa/openaiEmbeddings'
import { parseWorkspaceId } from '../../../../utils/enviarParaIa/parseWorkspaceId'
import {
  deleteByTermoId,
  findTermoHashesByWorkspace,
  insertTermoDocument,
} from '../../../../utils/enviarParaIa/termosPesquisa/documentsTermosVectorStore'
import { buildTermoEmbeddingPayload } from '../../../../utils/enviarParaIa/termosPesquisa/termoEmbeddingText'
import {
  countTermosIndexaveis,
  fetchTermosIndexaveisChunk,
} from '../../../../utils/enviarParaIa/termosPesquisa/termosIndexaveis'

type Body = {
  workspace_id?: unknown
  force?: unknown
  offset?: unknown
  limit?: unknown
}

const DEFAULT_CHUNK = 50

/** POST /api/produtos/enviar-para-ia/enviar-termos-pesquisa/envia-termos-para-vectorstore — indexa termos em uso. */
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
  const total = await countTermosIndexaveis(event, workspaceId)
  const rows = await fetchTermosIndexaveisChunk(event, workspaceId, offset, limit)

  const existingHashes = force
    ? new Map<string, string>()
    : await findTermoHashesByWorkspace(event, workspaceId)

  const toEmbed: ReturnType<typeof buildTermoEmbeddingPayload>[] = []
  let skipped = 0

  for (const row of rows) {
    const payload = buildTermoEmbeddingPayload(row, workspaceId)
    if (!payload) continue

    const prev = existingHashes.get(String(payload.termoId))
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
          errors.push(`Termo ${payload.termoId}: embedding vazio`)
          continue
        }

        try {
          await deleteByTermoId(event, workspaceId, payload.termoId)
          await insertTermoDocument(event, payload.content, payload.metadata, embedding)
          embedded++
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          errors.push(`Termo ${payload.termoId}: ${msg}`)
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
