import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import type { KanbanCriarFunilResponse } from '#shared/types/kanban'
import { assertMethod, createError, readBody } from 'h3'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

type Body = {
  workspace_id?: unknown
  nome?: unknown
}

function toInt(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  return n
}

function trimNome(raw: unknown): string | null {
  const t = String(raw ?? '').trim()
  return t.length > 0 ? t : null
}

const COLUNAS_PADRAO = [
  { nome: 'Em atendimento com I.A', cor: '#38BDF8', ordem: 1 },
  { nome: 'Precisa de Atendimento', cor: '#F59E0B', ordem: 2 },
  { nome: 'Prioridade', cor: '#F43F5E', ordem: 3 },
  { nome: 'Venda', cor: '#10B981', ordem: 4 },
] as const

/**
 * POST /api/kanban/funil
 * Body: `{ workspace_id, nome }`
 *
 * Cria registro em `funil_workspace` e colunas padrão em `funil_workspace_colunas`.
 */
export default defineEventHandler(async (event): Promise<KanbanCriarFunilResponse> => {
  assertMethod(event, 'POST')

  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const body = (await readBody<Body>(event).catch(() => null)) ?? {}

  const workspaceId = toInt(body.workspace_id)
  if (!workspaceId) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }

  const nome = trimNome(body.nome)
  if (!nome) {
    throw createError({ statusCode: 400, statusMessage: 'Informe o nome do funil.' })
  }

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: maxOrdemRow, error: maxOrdemErr } = await admin
    .from('funil_workspace')
    .select('ordem')
    .eq('workspace_id', workspaceId)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (maxOrdemErr) {
    throw createError({ statusCode: 500, statusMessage: maxOrdemErr.message })
  }

  const ordemAtual =
    maxOrdemRow && typeof maxOrdemRow === 'object' && 'ordem' in maxOrdemRow
      ? Number(maxOrdemRow.ordem)
      : 0
  const proximaOrdem =
    Number.isFinite(ordemAtual) && ordemAtual >= 1 ? Math.trunc(ordemAtual) + 1 : 1

  const nowIso = new Date().toISOString()

  const { data: funilRow, error: funilErr } = await admin
    .from('funil_workspace')
    .insert({
      workspace_id: workspaceId,
      nome,
      ordem: proximaOrdem,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select('id, nome, workspace_id, ordem')
    .single()

  if (funilErr) {
    throw createError({ statusCode: 500, statusMessage: funilErr.message })
  }

  const funilId =
    funilRow && typeof funilRow === 'object' && 'id' in funilRow
      ? typeof funilRow.id === 'number'
        ? funilRow.id
        : Number(funilRow.id)
      : null

  if (funilId == null || !Number.isFinite(funilId)) {
    throw createError({ statusCode: 500, statusMessage: 'Funil criado sem id retornado.' })
  }

  const cols = COLUNAS_PADRAO.map((c) => ({
    funil_id: funilId,
    nome: c.nome,
    cor: c.cor,
    ordem: c.ordem,
    updated_at: nowIso,
  }))

  const { data: colsInserted, error: colsErr } = await admin
    .from('funil_workspace_colunas')
    .insert(cols)
    .select('id, nome, cor, ordem')

  if (colsErr) {
    throw createError({ statusCode: 500, statusMessage: colsErr.message })
  }

  const columns = (Array.isArray(colsInserted) ? colsInserted : [])
    .map((row) => {
      const id = typeof row.id === 'number' ? row.id : Number(row.id)
      const ordem = typeof row.ordem === 'number' ? row.ordem : Number(row.ordem)
      const nome = String(row.nome ?? '').trim()
      const corRaw = row.cor
      const cor =
        typeof corRaw === 'string' && corRaw.trim() ? corRaw.trim() : corRaw != null ? String(corRaw) : null
      if (!Number.isFinite(id) || !Number.isFinite(ordem) || !nome) return null
      return { id: Math.trunc(id), nome, cor, ordem: Math.trunc(ordem) }
    })
    .filter((c): c is { id: number; nome: string; cor: string | null; ordem: number } => c != null)
    .sort((a, b) => a.ordem - b.ordem)

  return {
    ok: true,
    id: Math.trunc(funilId),
    nome,
    workspace_id: workspaceId,
    ordem: proximaOrdem,
    columns,
  }
})
