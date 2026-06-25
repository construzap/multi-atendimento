import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { ProdutosExcluirResponse } from '#shared/types/produtos'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { deleteByCodigo } from '../../../utils/enviarParaIa/documentsVectorStore'
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
    throw createError({ statusCode: 400, statusMessage: 'Informe pelo menos um id de produto válido.' })
  }
  return out
}

/**
 * POST /api/produtos/enviar-para-ia/excluir
 *
 * Body: `{ workspace_id, ids }` — remove produtos do banco e da vector store.
 */
export default defineEventHandler(async (event): Promise<ProdutosExcluirResponse> => {
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
    .from('produtos_workspace')
    .delete()
    .eq('workspace_id', workspaceId)
    .in('id', ids)
    .select('id, codigo')

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  for (const row of data ?? []) {
    const codigo = row.codigo != null ? String(row.codigo).trim() : ''
    if (!codigo) continue
    try {
      await deleteByCodigo(event, workspaceId, codigo)
    } catch {
      // Não bloqueia exclusão no banco se a vector store falhar
    }
  }

  const removidos = Array.isArray(data) ? data.length : 0
  return {
    removidos,
    ids: (data ?? [])
      .map((r: { id?: unknown }) => (typeof r.id === 'number' ? r.id : Number(r.id)))
      .filter((n: number) => Number.isFinite(n)),
  }
})
