import { serverSupabaseServiceRole } from '#supabase/server'
import { createError } from 'h3'
import type { H3Event } from 'h3'
import { buildTermoEmbeddingPayload } from './termoEmbeddingText'

/** View detalhada; sync indexa só linhas com `em_uso = true`. */
const VIEW = 'view_termos_pesquisa_detalhada'
const SELECT = 'id, nome, workspace_id'

function scopeTermosEmUso(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- query builder Supabase
  query: any,
  workspaceId: number,
) {
  return query.eq('workspace_id', workspaceId).eq('em_uso', true)
}

export async function countTermosIndexaveis(
  event: H3Event,
  workspaceId: number,
): Promise<number> {
  const admin = serverSupabaseServiceRole<any>(event)

  const { count, error } = await scopeTermosEmUso(
    admin.from(VIEW).select('id', { count: 'exact', head: true }),
    workspaceId,
  )

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

  const { data, error } = await scopeTermosEmUso(
    admin.from(VIEW).select(SELECT),
    workspaceId,
  )
    .order('id', { ascending: true })
    .range(from, to)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data ?? []
}

/**
 * Ids dos termos com `em_uso = true` (ligados a produto/variação ativo).
 * `em_uso = false` → órfão na vector store (cleanup remove).
 */
export async function fetchActiveTermoIdKeys(
  event: H3Event,
  workspaceId: number,
): Promise<Set<string>> {
  const admin = serverSupabaseServiceRole<any>(event)
  const ids = new Set<string>()
  const pageSize = 1000
  let from = 0

  while (true) {
    const { data, error } = await scopeTermosEmUso(
      admin.from(VIEW).select('id'),
      workspaceId,
    )
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
    const { data, error } = await scopeTermosEmUso(
      admin.from(VIEW).select(SELECT),
      workspaceId,
    )
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
