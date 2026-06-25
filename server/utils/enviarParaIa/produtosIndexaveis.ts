import { serverSupabaseServiceRole } from '#supabase/server'
import { createError } from 'h3'
import type { H3Event } from 'h3'
import {
  isProdutoIndexavel,
  SELECT_VIEW_PRODUTOS_EMBEDDING,
  buildProdutoEmbeddingPayload,
} from './produtoEmbeddingText'

const VIEW = 'view_produtos_com_variacoes'

export async function countProdutosIndexaveis(
  event: H3Event,
  workspaceId: number,
): Promise<number> {
  const admin = serverSupabaseServiceRole<any>(event)

  const { count, error } = await admin
    .from(VIEW)
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', true)
    .is('parent_id', null)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return count ?? 0
}

export async function fetchProdutosIndexaveisChunk(
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
    .select(SELECT_VIEW_PRODUTOS_EMBEDDING)
    .eq('workspace_id', workspaceId)
    .eq('status', true)
    .is('parent_id', null)
    .order('id', { ascending: true })
    .range(from, to)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return (data ?? []).filter((row) => isProdutoIndexavel(row as Record<string, unknown>))
}

async function fetchIndexableProdutoRows(
  event: H3Event,
  workspaceId: number,
  select: string,
): Promise<Record<string, unknown>[]> {
  const admin = serverSupabaseServiceRole<any>(event)
  const rows: Record<string, unknown>[] = []
  const pageSize = 1000
  let from = 0

  while (true) {
    const { data, error } = await admin
      .from(VIEW)
      .select(select)
      .eq('workspace_id', workspaceId)
      .eq('status', true)
      .is('parent_id', null)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message })
    }

    const chunk = data ?? []
    for (const row of chunk) {
      if (!isProdutoIndexavel(row as Record<string, unknown>)) continue
      rows.push(row as Record<string, unknown>)
    }

    if (chunk.length < pageSize) break
    from += pageSize
  }

  return rows
}

/** Códigos sequenciais dos produtos indexáveis do workspace (usado na vector store). */
export async function fetchIndexableProdutoCodigos(
  event: H3Event,
  workspaceId: number,
): Promise<Set<string>> {
  const rows = await fetchIndexableProdutoRows(event, workspaceId, 'id, codigo, status, parent_id')
  const codigos = new Set<string>()

  for (const row of rows) {
    const codigo = row.codigo != null ? String(row.codigo).trim() : ''
    if (codigo) codigos.add(codigo)
  }

  return codigos
}

export type IndexableProdutoSyncStatus = {
  activeCodigos: Set<string>
  sincronizados: number
  pendentes: number
}

/** Conta sincronizados (hash igual ao atual) e pendentes (ausente ou hash desatualizado). */
export async function computeIndexableProdutoSyncStatus(
  event: H3Event,
  workspaceId: number,
  existingHashes: Map<string, string>,
): Promise<IndexableProdutoSyncStatus> {
  const rows = await fetchIndexableProdutoRows(event, workspaceId, SELECT_VIEW_PRODUTOS_EMBEDDING)
  const activeCodigos = new Set<string>()
  let sincronizados = 0
  let pendentes = 0

  for (const row of rows) {
    const codigo = row.codigo != null ? String(row.codigo).trim() : ''
    if (codigo) activeCodigos.add(codigo)

    const payload = buildProdutoEmbeddingPayload(row, workspaceId)
    if (!payload) continue

    const prev = codigo ? existingHashes.get(codigo) : undefined
    if (prev === payload.contentHash) sincronizados++
    else pendentes++
  }

  return { activeCodigos, sincronizados, pendentes }
}

export async function fetchIndexableProdutoIds(
  event: H3Event,
  workspaceId: number,
): Promise<Set<number>> {
  const rows = await fetchIndexableProdutoRows(event, workspaceId, 'id, status, parent_id')
  const ids = new Set<number>()

  for (const row of rows) {
    const id = Number(row.id)
    if (Number.isFinite(id)) ids.add(id)
  }

  return ids
}
