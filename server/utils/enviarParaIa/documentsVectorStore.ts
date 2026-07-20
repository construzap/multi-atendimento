import { createError } from 'h3'
import type { H3Event } from 'h3'
import type { DocumentMetadata, SearchHit, VectorStoreSearchFilters } from '#shared/types/vectorStore'
import { parseProdutoIdFromContent } from './produtoEmbeddingText'
import { getSupabaseVectorClient } from './supabaseVector'

const DEFAULT_TABLE = 'documentsconstruzapmulti'

function getDocumentsTable(event: H3Event): string {
  const config = useRuntimeConfig(event)
  const table = String(config.vectorDocumentsTable ?? '').trim()
  return table || DEFAULT_TABLE
}

export function matchesWorkspaceMetadata(meta: unknown, workspaceId: number): boolean {
  if (meta == null || typeof meta !== 'object') return false
  const rec = meta as Record<string, unknown>
  const raw = rec.workspace_id ?? rec.empresa_id
  if (raw == null) return false
  return String(raw) === String(workspaceId)
}

function workspaceMetadataOrFilter(workspaceId: number): string {
  const ws = String(workspaceId)
  return [
    `metadata->>workspace_id.eq.${ws}`,
    `metadata.cs.{"workspace_id":"${ws}"}`,
    `metadata.cs.{"workspace_id":${workspaceId}}`,
    `metadata->>empresa_id.eq.${ws}`,
    `metadata.cs.{"empresa_id":"${ws}"}`,
    `metadata.cs.{"empresa_id":${workspaceId}}`,
  ].join(',')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- query builder do Supabase
function scopeByWorkspace(query: any, workspaceId: number) {
  return query.or(workspaceMetadataOrFilter(workspaceId))
}

export async function countByWorkspace(event: H3Event, workspaceId: number): Promise<number> {
  const client = getSupabaseVectorClient(event)
  const table = getDocumentsTable(event)

  const { count, error } = await scopeByWorkspace(
    client.from(table).select('id', { count: 'exact', head: true }),
    workspaceId,
  )

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return count ?? 0
}

export async function findHashesByWorkspace(
  event: H3Event,
  workspaceId: number,
): Promise<Map<string, string>> {
  const client = getSupabaseVectorClient(event)
  const map = new Map<string, string>()
  const table = getDocumentsTable(event)

  const pageSize = 1000
  let from = 0

  while (true) {
    const { data, error } = await scopeByWorkspace(
      client.from(table).select('metadata, content'),
      workspaceId,
    ).range(from, from + pageSize - 1)

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message })
    }

    const rows = data ?? []
    for (const row of rows) {
      const meta = row.metadata as DocumentMetadata | null
      if (!matchesWorkspaceMetadata(meta, workspaceId)) continue
      if (!meta?.content_hash) continue

      const produtoId = parseProdutoIdFromContent(String(row.content ?? ''))
      if (!produtoId) continue

      map.set(produtoId, meta.content_hash)
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  return map
}

export type VectorDocumentRow = {
  id: string
  produtoId: string | null
}

export async function listVectorDocumentsChunk(
  event: H3Event,
  workspaceId: number,
  offset: number,
  limit: number,
): Promise<VectorDocumentRow[]> {
  const client = getSupabaseVectorClient(event)
  const table = getDocumentsTable(event)
  const from = Math.max(0, offset)
  const to = from + Math.max(1, Math.min(limit, 100)) - 1

  const { data, error } = await scopeByWorkspace(
    client.from(table).select('id, metadata, content'),
    workspaceId,
  ).range(from, to)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const rows: VectorDocumentRow[] = []
  for (const row of data ?? []) {
    if (!matchesWorkspaceMetadata(row.metadata, workspaceId)) continue
    rows.push({
      id: String(row.id),
      produtoId: parseProdutoIdFromContent(String(row.content ?? '')),
    })
  }

  return rows
}

export async function deleteDocumentById(event: H3Event, documentId: string): Promise<void> {
  const client = getSupabaseVectorClient(event)

  const { error } = await client.from(getDocumentsTable(event)).delete().eq('id', documentId)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
}

export async function countOrphanDocuments(
  event: H3Event,
  workspaceId: number,
  activeProdutoIds: Set<string>,
): Promise<number> {
  const client = getSupabaseVectorClient(event)
  const table = getDocumentsTable(event)
  const pageSize = 1000
  let from = 0
  let orfaos = 0

  while (true) {
    const { data, error } = await scopeByWorkspace(
      client.from(table).select('id, metadata, content'),
      workspaceId,
    ).range(from, from + pageSize - 1)

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message })
    }

    const rows = data ?? []
    for (const row of rows) {
      if (!matchesWorkspaceMetadata(row.metadata, workspaceId)) continue
      const produtoId = parseProdutoIdFromContent(String(row.content ?? ''))
      if (!produtoId || !activeProdutoIds.has(produtoId)) orfaos++
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  return orfaos
}

export async function deleteByProdutoId(
  event: H3Event,
  workspaceId: number,
  produtoId: number | string,
): Promise<void> {
  const client = getSupabaseVectorClient(event)
  const ws = String(workspaceId)
  const id = String(produtoId).trim()
  if (!id) return

  const prefix = `Id: ${id}  |`

  const { error } = await client
    .from(getDocumentsTable(event))
    .delete()
    .or(`metadata->>workspace_id.eq.${ws},metadata->>empresa_id.eq.${ws}`)
    .like('content', `${prefix}%`)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
}

export async function insertDocument(
  event: H3Event,
  content: string,
  metadata: DocumentMetadata,
  embedding: number[],
): Promise<void> {
  const client = getSupabaseVectorClient(event)

  const { error } = await client.from(getDocumentsTable(event)).insert({
    content,
    metadata,
    embedding,
  })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
}

function parseEmbedding(raw: unknown): number[] | null {
  if (Array.isArray(raw)) {
    return raw.map((v) => Number(v)).filter((v) => Number.isFinite(v))
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) return parsed.map((v) => Number(v))
    } catch {
      return null
    }
  }
  return null
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || !a.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    na += a[i]! * a[i]!
    nb += b[i]! * b[i]!
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

export async function searchSimilar(
  event: H3Event,
  filters: VectorStoreSearchFilters,
  queryEmbedding: number[],
  limit = 10,
): Promise<SearchHit[]> {
  const { workspaceId, termosPesquisa } = filters
  const termosFilter = termosPesquisa?.trim().toLowerCase() ?? ''

  const client = getSupabaseVectorClient(event)
  const maxDocs = 3000

  const { data, error } = await scopeByWorkspace(
    client.from(getDocumentsTable(event)).select('id, content, metadata, embedding'),
    workspaceId,
  ).limit(maxDocs)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const scored: SearchHit[] = []

  for (const row of data ?? []) {
    const meta = row.metadata
    if (!matchesWorkspaceMetadata(meta, workspaceId)) continue

    if (termosFilter) {
      const rec = meta as Record<string, unknown> | null
      const termos = rec?.termos_pesquisa ?? rec?.categorias
      const termosText = typeof termos === 'string' ? termos.toLowerCase() : ''
      if (!termosText.includes(termosFilter)) continue
    }

    const emb = parseEmbedding(row.embedding)
    if (!emb) continue
    const similarity = cosineSimilarity(queryEmbedding, emb)
    scored.push({
      id: String(row.id),
      content: String(row.content ?? ''),
      metadata: (row.metadata ?? {}) as DocumentMetadata,
      similarity,
    })
  }

  scored.sort((a, b) => b.similarity - a.similarity)
  return scored.slice(0, Math.max(1, Math.min(limit, 50)))
}
