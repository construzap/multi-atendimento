import { createError } from 'h3'
import type { H3Event } from 'h3'
import type { DocumentMetadata, SearchHit } from '#shared/types/vectorStore'
import {
  cosineSimilarity,
  getDocumentsTable,
  matchesWorkspaceMetadata,
  parseEmbedding,
  scopeByWorkspace,
} from './documentsVectorStore'
import { getSupabaseVectorClient } from './supabaseVector'

const PAGE_SIZE = 500

function sanitizeIlikeTerm(raw: string): string {
  return raw.replace(/[%_,.()]/g, ' ').replace(/\s+/g, ' ').trim()
}

function rowMatchesTermo(meta: unknown, termo: string): boolean {
  if (meta == null || typeof meta !== 'object') return false
  const rec = meta as Record<string, unknown>
  const termos = rec.termos_pesquisa ?? rec.categorias
  const termosText = typeof termos === 'string' ? termos.toLowerCase() : ''
  return termosText.includes(termo)
}

/**
 * Busca filtrada no SQL por workspace + termos_pesquisa (usada por filtrar-produtos).
 * Não carrega o catálogo inteiro: o termo restringe o lote antes do limit.
 */
export async function searchSimilarPorTermo(
  event: H3Event,
  filters: { workspaceId: number; termosPesquisa: string },
  queryEmbedding: number[],
  limit = 10,
): Promise<SearchHit[]> {
  const workspaceId = filters.workspaceId
  const termo = sanitizeIlikeTerm(filters.termosPesquisa).toLowerCase()
  if (!termo) {
    throw createError({
      statusCode: 400,
      statusMessage: 'termos_pesquisa é obrigatório para busca filtrada.',
    })
  }

  const client = getSupabaseVectorClient(event)
  const table = getDocumentsTable(event)
  const scored: SearchHit[] = []
  let from = 0

  while (true) {
    const { data, error } = await scopeByWorkspace(
      client.from(table).select('id, content, metadata, embedding'),
      workspaceId,
    )
      .filter('metadata->>termos_pesquisa', 'ilike', `%${termo}%`)
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message })
    }

    const rows = data ?? []
    for (const row of rows) {
      const meta = row.metadata
      if (!matchesWorkspaceMetadata(meta, workspaceId)) continue
      if (!rowMatchesTermo(meta, termo)) continue

      const emb = parseEmbedding(row.embedding)
      if (!emb) continue
      scored.push({
        id: String(row.id),
        content: String(row.content ?? ''),
        metadata: (row.metadata ?? {}) as DocumentMetadata,
        similarity: cosineSimilarity(queryEmbedding, emb),
      })
    }

    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  scored.sort((a, b) => b.similarity - a.similarity)
  return scored.slice(0, Math.max(1, Math.min(limit, 50)))
}
