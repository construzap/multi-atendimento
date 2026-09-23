import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type {
  ProdutoTermoPesquisaItem,
  ProdutosTermosPesquisaReordenarResponse,
} from '#shared/types/produtos'
import { mapTermoPesquisaRow } from '../../../utils/produtoTermosPesquisa'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { getAuthUserId } from '../../../utils/getAuthUserId'

type Body = {
  workspace_id?: unknown
  itens?: unknown
}

const MAX_ITENS = 500

function parseWorkspaceId(raw: unknown): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }
  return n
}

function parseItens(raw: unknown): { id: number; ordem: number }[] {
  if (!Array.isArray(raw) || !raw.length) {
    throw createError({ statusCode: 400, statusMessage: 'Envie `itens` com id e ordem.' })
  }
  if (raw.length > MAX_ITENS) {
    throw createError({
      statusCode: 400,
      statusMessage: `No máximo ${MAX_ITENS} itens por requisição.`,
    })
  }
  return raw.map((x, i) => {
    const rec = x as { id?: unknown; ordem?: unknown }
    const id =
      typeof rec.id === 'number' ? Math.trunc(rec.id) : Number.parseInt(String(rec.id ?? ''), 10)
    const ordem =
      typeof rec.ordem === 'number'
        ? Math.trunc(rec.ordem)
        : Number.parseInt(String(rec.ordem ?? ''), 10)
    if (!Number.isFinite(id) || id < 1) {
      throw createError({ statusCode: 400, statusMessage: `Item ${i + 1}: id inválido.` })
    }
    if (!Number.isFinite(ordem) || ordem < 0) {
      throw createError({ statusCode: 400, statusMessage: `Item ${i + 1}: ordem inválida.` })
    }
    return { id, ordem }
  })
}

/**
 * POST /api/produtos/termos-de-pesquisa/reordenar
 * Atualiza `ordem` em `produto_termo_de_pesquisa` no workspace.
 */
export default defineEventHandler(async (event): Promise<ProdutosTermosPesquisaReordenarResponse> => {
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
  const workspaceId = parseWorkspaceId(body.workspace_id)
  const itens = parseItens(body.itens)
  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)
  const atualizados: ProdutoTermoPesquisaItem[] = []

  for (const item of itens) {
    const { data: row, error: upErr } = await admin
      .from('produto_termo_de_pesquisa')
      .update({ ordem: item.ordem })
      .eq('id', item.id)
      .eq('workspace_id', workspaceId)
      .select('id, nome, ordem')
      .maybeSingle()

    if (upErr) {
      throw createError({ statusCode: 500, statusMessage: upErr.message })
    }
    if (row && typeof row === 'object') {
      atualizados.push(mapTermoPesquisaRow(row as Record<string, unknown>))
    }
  }

  return { atualizados: atualizados.length, data: atualizados }
})
