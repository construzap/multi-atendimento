import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type { Anotacao, AnotacaoTipo, AnotacoesListResponse } from '#shared/types/anotacao'
import { ANOTACOES_PER_PAGE } from '#shared/types/anotacao'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

const SELECT =
  'id, conversa_key, workspace_id, canal_id, tipo_anotacao, anotacao_text, media_url, created_at, updated_at'

const TIPOS: AnotacaoTipo[] = ['texto', 'audio', 'imagem', 'video', 'documento']

function parsePositiveInt(raw: unknown, label: string): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  return n
}

function parseNonNegInt(raw: unknown, label: string): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  return n
}

function parseOffset(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') return 0
  return parseNonNegInt(raw, 'offset')
}

function parsePerPage(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') return ANOTACOES_PER_PAGE
  const n = parsePositiveInt(raw, 'per_page')
  return Math.min(50, n)
}

function mapRow(row: Record<string, unknown>): Anotacao {
  const tipoRaw = String(row.tipo_anotacao ?? 'texto').trim().toLowerCase()
  const tipo = (TIPOS as string[]).includes(tipoRaw) ? (tipoRaw as AnotacaoTipo) : 'texto'
  return {
    id: typeof row.id === 'number' ? row.id : Number(row.id),
    conversa_key: String(row.conversa_key ?? ''),
    workspace_id: typeof row.workspace_id === 'number' ? row.workspace_id : Number(row.workspace_id),
    canal_id: typeof row.canal_id === 'number' ? row.canal_id : Number(row.canal_id),
    tipo_anotacao: tipo,
    anotacao_text: String(row.anotacao_text ?? ''),
    media_url: typeof row.media_url === 'string' && row.media_url.trim() ? row.media_url.trim() : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : null,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
  }
}

/**
 * GET /api/anotacoes_conversas?workspace_id=&conversa_key=&offset=&per_page=
 * Ordena da mais recente para a mais antiga (`created_at` desc, `id` desc).
 * Paginação padrão: 5 por página (offset + per_page).
 */
export default defineEventHandler(async (event): Promise<AnotacoesListResponse> => {
  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const q = getQuery(event)
  const workspaceId = parsePositiveInt(q.workspace_id, 'workspace_id')
  const conversaKey = String(q.conversa_key ?? '').trim()
  if (!conversaKey) {
    throw createError({ statusCode: 400, statusMessage: 'Informe conversa_key.' })
  }

  const offset = parseOffset(q.offset)
  const perPage = parsePerPage(q.per_page)
  const from = offset
  const to = from + perPage - 1

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)
  const { data, error, count } = await admin
    .from('anotacoes')
    .select(SELECT, { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .eq('conversa_key', conversaKey)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const rows = (data ?? []) as Record<string, unknown>[]
  return {
    data: rows.map(mapRow),
    offset,
    perPage,
    total: count ?? 0,
  }
})
