import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { ProdutosOportunidadesVendasExcluirResponse } from '#shared/types/produtos'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { getAuthUserId } from '../../../utils/getAuthUserId'

const MAX_IDS = 500

type Body = {
  workspace_id?: unknown
  ids?: unknown
}

function parsePositiveInt(raw: unknown, label: string): number {
  const s = String(raw ?? '').trim()
  if (!s) {
    throw createError({ statusCode: 400, statusMessage: `${label} é obrigatório.` })
  }
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  if (String(n) !== s) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  return n
}

function parseIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) {
    throw createError({ statusCode: 400, statusMessage: 'Envie `ids` como array de inteiros.' })
  }
  const out: number[] = []
  const seen = new Set<number>()
  for (const x of raw) {
    const n = typeof x === 'number' ? x : Number.parseInt(String(x ?? '').trim(), 10)
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) continue
    if (seen.has(n)) continue
    seen.add(n)
    out.push(n)
    if (out.length >= MAX_IDS) break
  }
  if (out.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Informe pelo menos um id de ocorrência válido.' })
  }
  return out
}

/**
 * POST /api/produtos/oportunidades-de-vendas/excluir
 *
 * Body: `{ workspace_id, ids }` — apaga linhas em `produtos_nao_encontrados`
 * (ids vindos de `ocorrencias[].id` da oportunidade).
 */
export default defineEventHandler(async (event): Promise<ProdutosOportunidadesVendasExcluirResponse> => {
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
  const workspaceId = parsePositiveInt(body.workspace_id, 'workspace_id')
  const ids = parseIds(body.ids)

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data, error } = await admin
    .from('produtos_nao_encontrados')
    .delete()
    .eq('workspace_id', workspaceId)
    .in('id', ids)
    .select('id')

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const removedIds = (data ?? [])
    .map((r: { id?: unknown }) => {
      const n = typeof r.id === 'number' ? r.id : Number.parseInt(String(r.id ?? ''), 10)
      return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
    })
    .filter((n: number | null): n is number => n != null)

  return {
    removidos: removedIds.length,
    ids: removedIds,
  }
})
