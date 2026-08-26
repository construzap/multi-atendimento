import { serverSupabaseServiceRole } from '#supabase/server'
import { createError } from 'h3'
import type { H3Event } from 'h3'
import { buildTermoEmbeddingPayload } from './termoEmbeddingText'

const VIEW = 'view_termos_pesquisa_em_uso'
const SELECT = 'id, nome, workspace_id'

export async function countTermosIndexaveis(
  event: H3Event,
  workspaceId: number,
): Promise<number> {
  const admin = serverSupabaseServiceRole<any>(event)

  const { count, error } = await admin
    .from(VIEW)
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return count ?? 0
}

export async function fetchTermosIndexaveisChunk(
  event: H3Event,
  workspaceId: number,
  offset: number,
  limit: number,
): Promise<Record<string, unknown>[]> {
  const admin = serverSupabaseServiceRole<any>(event)
  const from = Math.max(0, offset)
  const to = from + Math.max(1, Math.min(limit, 100)) - 1

  const { data, error } = await admin
    .from(VIEW)
    .select(SELECT)
    .eq('workspace_id', workspaceId)
    .order('id', { ascending: true })
    .range(from, to)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data ?? []
}

/** Ids dos termos em uso (`metadata.termo_id` na vector store). */
export async function fetchActiveTermoIdKeys(
  event: H3Event,
  workspaceId: number,
): Promise<Set<string>> {
  const admin = serverSupabaseServiceRole<any>(event)
  const ids = new Set<string>()
  const pageSize = 1000
  let from = 0

  while (true) {
    const { data, error } = await admin
      .from(VIEW)
      .select('id')
      .eq('workspace_id', workspaceId)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message })
    }

    const chunk = data ?? []
    for (const row of chunk) {
      const id = Number(row.id)
      if (Number.isFinite(id)) ids.add(String(id))
    }

    if (chunk.length < pageSize) break
    from += pageSize
  }

  return ids
}

export type TermoSyncStatus = {
  activeTermoIds: Set<string>
  sincronizados: number
  pendentes: number
}

export async function computeTermoSyncStatus(
  event: H3Event,
  workspaceId: number,
  existingHashes: Map<string, string>,
): Promise<TermoSyncStatus> {
  const admin = serverSupabaseServiceRole<any>(event)
  const activeTermoIds = new Set<string>()
  let sincronizados = 0
  let pendentes = 0
  const pageSize = 1000
  let from = 0

  while (true) {
    const { data, error } = await admin
      .from(VIEW)
      .select(SELECT)
      .eq('workspace_id', workspaceId)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message })
    }

    const chunk = data ?? []
    for (const row of chunk) {
      const payload = buildTermoEmbeddingPayload(row as Record<string, unknown>, workspaceId)
      if (!payload) continue

      const key = String(payload.termoId)
      activeTermoIds.add(key)

      const prev = existingHashes.get(key)
      if (prev === payload.contentHash) sincronizados++
      else pendentes++
    }

    if (chunk.length < pageSize) break
    from += pageSize
  }

  return { activeTermoIds, sincronizados, pendentes }
}
