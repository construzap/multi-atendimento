import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import type { KanbanFunilColunaResumo, KanbanFunilItem, KanbanListarFunisResponse } from '#shared/types/kanban'
import { createError, getQuery } from 'h3'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

function toInt(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  return n
}

function rowToColuna(row: Record<string, unknown>): KanbanFunilColunaResumo | null {
  const id = toInt(row.id)
  const ordemRaw = row.ordem
  const ordem =
    ordemRaw != null && Number.isFinite(Number(ordemRaw)) ? Math.trunc(Number(ordemRaw)) : null
  const nome = String(row.nome ?? '').trim()
  if (id == null || ordem == null || !nome) return null

  const corRaw = row.cor
  const cor =
    typeof corRaw === 'string' && corRaw.trim() ? corRaw.trim() : corRaw != null ? String(corRaw) : null

  return { id, nome, cor, ordem }
}

function rowToFunil(row: Record<string, unknown>, columns: KanbanFunilColunaResumo[] = []): KanbanFunilItem | null {
  const id = toInt(row.id)
  const workspaceId = toInt(row.workspace_id)
  const nome = String(row.nome ?? '').trim()
  if (id == null || workspaceId == null || !nome) return null

  const createdAt = row.created_at != null ? String(row.created_at) : new Date().toISOString()
  const updatedAt =
    row.updated_at != null && String(row.updated_at).trim()
      ? String(row.updated_at)
      : null

  const ordemRaw = row.ordem
  const ordem =
    ordemRaw != null && Number.isFinite(Number(ordemRaw)) && Number(ordemRaw) >= 1
      ? Math.trunc(Number(ordemRaw))
      : 1

  return {
    id,
    nome,
    workspace_id: workspaceId,
    ordem,
    created_at: createdAt,
    updated_at: updatedAt,
    columns,
  }
}

/**
 * GET /api/kanban/funil?workspace_id=
 * Lista funis do workspace em `funil_workspace` com colunas em `funil_workspace_colunas`.
 */
export default defineEventHandler(async (event): Promise<KanbanListarFunisResponse> => {
  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const query = getQuery(event)
  const workspaceId = toInt(query.workspace_id)
  if (!workspaceId) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data, error } = await admin
    .from('funil_workspace')
    .select('id, nome, workspace_id, ordem, created_at, updated_at')
    .eq('workspace_id', workspaceId)
    .order('ordem', { ascending: true })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const funisBase = (Array.isArray(data) ? data : [])
    .map((row) => rowToFunil(row as Record<string, unknown>))
    .filter((f): f is KanbanFunilItem => f != null)

  const funilIds = funisBase.map((f) => f.id)
  const columnsByFunil = new Map<number, KanbanFunilColunaResumo[]>()

  if (funilIds.length > 0) {
    const { data: colRows, error: colErr } = await admin
      .from('funil_workspace_colunas')
      .select('id, nome, cor, ordem, funil_id')
      .in('funil_id', funilIds)
      .is('deleted_at', null)
      .order('ordem', { ascending: true })

    if (colErr) {
      throw createError({ statusCode: 500, statusMessage: colErr.message })
    }

    for (const row of colRows ?? []) {
      const col = rowToColuna(row as Record<string, unknown>)
      const funilId = toInt((row as Record<string, unknown>).funil_id)
      if (!col || funilId == null) continue
      const list = columnsByFunil.get(funilId) ?? []
      list.push(col)
      columnsByFunil.set(funilId, list)
    }
  }

  const funis = funisBase.map((f) => ({
    ...f,
    columns: columnsByFunil.get(f.id) ?? [],
  }))

  return { funis }
})
