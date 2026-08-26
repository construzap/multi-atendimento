import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getQuery } from 'h3'
import type { EntregadoresListResponse, EntregadorListaItem } from '#shared/types/entregadores'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

function parseWorkspaceId(raw: unknown): number {
  const n =
    typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }
  return n
}

function mapRow(r: Record<string, unknown>): EntregadorListaItem | null {
  const id = typeof r.id === 'number' ? r.id : Number(r.id)
  if (!Number.isFinite(id) || id < 1) return null
  return {
    id,
    codigo: String(r.codigo ?? '').trim(),
    nome: String(r.nome ?? '').trim(),
    ativo: r.ativo !== false,
    created_at: r.created_at != null ? String(r.created_at) : '',
    updated_at: r.updated_at != null ? String(r.updated_at) : '',
  }
}

/**
 * GET /api/entregadores?workspace_id=
 */
export default defineEventHandler(async (event): Promise<EntregadoresListResponse> => {
  assertMethod(event, 'GET')

  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }
  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const workspaceId = parseWorkspaceId(getQuery(event).workspace_id)
  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)
  const { data, error } = await admin
    .from('entregadores')
    .select('id, codigo, nome, ativo, created_at, updated_at')
    .eq('workspace_id', workspaceId)
    .order('codigo', { ascending: true })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const mapped = ((data ?? []) as Record<string, unknown>[])
    .map(mapRow)
    .filter((x): x is EntregadorListaItem => x != null)

  return { data: mapped }
})
