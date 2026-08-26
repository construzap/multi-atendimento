import { createError } from 'h3'
import type { H3Event } from 'h3'
import type { TermoDocumentMetadata, TermoSearchHit, TermoVectorStoreSearchFilters } from '#shared/types/vectorStore'
import { matchesWorkspaceMetadata } from '../documentsVectorStore'
import { getSupabaseVectorClient } from '../supabaseVector'
import { parseTermoIdFromContent, parseTermoIdFromMetadata } from './termoEmbeddingText'

const DEFAULT_TABLE = 'documents_termos_pesquisa'

function getTermosDocumentsTable(event: H3Event): string {
  const config = useRuntimeConfig(event)
  const table = String(config.vectorTermosDocumentsTable ?? '').trim()
  return table || DEFAULT_TABLE
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

export async function countTermosByWorkspace(event: H3Event, workspaceId: number): Promise<number> {
  const client = getSupabaseVectorClient(event)
  const table = getTermosDocumentsTable(event)

  const { count, error } = await scopeByWorkspace(
    client.from(table).select('id', { count: 'exact', head: true }),
    workspaceId,
  )

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return count ?? 0
}

export async function findTermoHashesByWorkspace(
  event: H3Event,
  workspaceId: number,
): Promise<Map<string, string>> {
  const client = getSupabaseVectorClient(event)
  const map = new Map<string, string>()
  const table = getTermosDocumentsTable(event)

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
      const meta = row.metadata as TermoDocumentMetadata | null
      if (!matchesWorkspaceMetadata(meta, workspaceId)) continue
      if (!meta?.content_hash) continue

      const termoId =
        parseTermoIdFromMetadata(meta) ?? parseTermoIdFromContent(String(row.content ?? ''))
      if (!termoId) continue

      map.set(termoId, meta.content_hash)
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  return map
}

export type TermoVectorDocumentRow = {
  id: string
  termoId: string | null
}

export async function listTermoVectorDocumentsChunk(
  event: H3Event,
  workspaceId: number,
  offset: number,
  limit: number,
): Promise<TermoVectorDocumentRow[]> {
  const client = getSupabaseVectorClient(event)
  const table = getTermosDocumentsTable(event)
  const from = Math.max(0, offset)
  const to = from + Math.max(1, Math.min(limit, 100)) - 1

  const { data, error } = await scopeByWorkspace(
    client.from(table).select('id, metadata, content'),
    workspaceId,
  ).range(from, to)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const rows: TermoVectorDocumentRow[] = []
  for (const row of data ?? []) {
    if (!matchesWorkspaceMetadata(row.metadata, workspaceId)) continue
    rows.push({
      id: String(row.id),
      termoId:
        parseTermoIdFromMetadata(row.metadata) ??
        parseTermoIdFromContent(String(row.content ?? '')),
    })
  }

  return rows
}

export async function deleteTermoDocumentById(event: H3Event, documentId: string): Promise<void> {
  const client = getSupabaseVectorClient(event)

  const { error } = await client.from(getTermosDocumentsTable(event)).delete().eq('id', documentId)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
}

export async function countOrphanTermoDocuments(
  event: H3Event,
  workspaceId: number,
  activeTermoIds: Set<string>,
): Promise<number> {
  const client = getSupabaseVectorClient(event)
  const table = getTermosDocumentsTable(event)
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
      const termoId =
        parseTermoIdFromMetadata(row.metadata) ??
        parseTermoIdFromContent(String(row.content ?? ''))
      if (!termoId || !activeTermoIds.has(termoId)) orfaos++
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  return orfaos
}

export async function deleteByTermoId(
  event: H3Event,
  workspaceId: number,
  termoId: number | string,
): Promise<void> {
  const client = getSupabaseVectorClient(event)
  const table = getTermosDocumentsTable(event)
  const ws = String(workspaceId)
  const id = String(termoId).trim()
  if (!id) return

  const workspaceFilter = `metadata->>workspace_id.eq.${ws},metadata->>empresa_id.eq.${ws}`

  const { error: metaErr } = await client
    .from(table)
    .delete()
    .eq('metadata->>termo_id', id)
    .or(workspaceFilter)

  if (metaErr) {
    throw createError({ statusCode: 500, statusMessage: metaErr.message })
  }

  // Documentos legados (content com prefixo antigo)
  const legacyPrefix = `codigo do termo: ${id}  |`
  const { error: legacyErr } = await client
    .from(table)
    .delete()
    .or(workspaceFilter)
    .like('content', `${legacyPrefix}%`)

  if (legacyErr) {
    throw createError({ statusCode: 500, statusMessage: legacyErr.message })
  }
}

export async function insertTermoDocument(
  event: H3Event,
  content: string,
  metadata: TermoDocumentMetadata,
  embedding: number[],
): Promise<void> {
  const client = getSupabaseVectorClient(event)

  const { error } = await client.from(getTermosDocumentsTable(event)).insert({
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

function matchesMetadataFilters(
  meta: unknown,
  filters: Record<string, string> | null | undefined,
): boolean {
  if (!filters || !Object.keys(filters).length) return true
  if (meta == null || typeof meta !== 'object') return false

  const rec = meta as Record<string, unknown>
  for (const [key, expected] of Object.entries(filters)) {
    const actual = rec[key]
    if (actual == null) return false
    if (String(actual).trim().toLowerCase() !== expected.trim().toLowerCase()) return false
  }
  return true
}

export async function searchTermosSimilar(
  event: H3Event,
  filters: TermoVectorStoreSearchFilters,
  queryEmbedding: number[],
  limit = 10,
): Promise<TermoSearchHit[]> {
  const { workspaceId, metadata } = filters

  const client = getSupabaseVectorClient(event)
  const table = getTermosDocumentsTable(event)
  const maxDocs = 3000

  const { data, error } = await scopeByWorkspace(
    client.from(table).select('id, content, metadata, embedding'),
    workspaceId,
  ).limit(maxDocs)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const scored: TermoSearchHit[] = []

  for (const row of data ?? []) {
    const meta = row.metadata
    if (!matchesWorkspaceMetadata(meta, workspaceId)) continue
    if (!matchesMetadataFilters(meta, metadata)) continue

    const emb = parseEmbedding(row.embedding)
    if (!emb) continue
    const similarity = cosineSimilarity(queryEmbedding, emb)
    scored.push({
      id: String(row.id),
      content: String(row.content ?? ''),
      metadata: (row.metadata ?? {}) as TermoDocumentMetadata,
      similarity,
    })
  }

  scored.sort((a, b) => b.similarity - a.similarity)
  return scored.slice(0, Math.max(1, Math.min(limit, 50)))
}
