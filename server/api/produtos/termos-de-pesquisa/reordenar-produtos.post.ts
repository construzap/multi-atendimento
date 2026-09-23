import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { ProdutosVinculoReordenarResponse } from '#shared/types/produtos'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { getAuthUserId } from '../../../utils/getAuthUserId'

type Body = {
  workspace_id?: unknown
  termo_id?: unknown
  itens?: unknown
}

const MAX_ITENS = 1000

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

function parseItens(raw: unknown): { produto_id: number; ordem: number }[] {
  if (!Array.isArray(raw) || !raw.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Envie `itens` com produto_id (ou id) e ordem.',
    })
  }
  if (raw.length > MAX_ITENS) {
    throw createError({
      statusCode: 400,
      statusMessage: `No máximo ${MAX_ITENS} itens por requisição.`,
    })
  }
  return raw.map((x, i) => {
    const rec = x as { produto_id?: unknown; id?: unknown; ordem?: unknown }
    const rawId = rec.produto_id ?? rec.id
    const produto_id =
      typeof rawId === 'number' ? Math.trunc(rawId) : Number.parseInt(String(rawId ?? ''), 10)
    const ordem =
      typeof rec.ordem === 'number'
        ? Math.trunc(rec.ordem)
        : Number.parseInt(String(rec.ordem ?? ''), 10)
    if (!Number.isFinite(produto_id) || produto_id < 1) {
      throw createError({ statusCode: 400, statusMessage: `Item ${i + 1}: produto_id inválido.` })
    }
    if (!Number.isFinite(ordem) || ordem < 0) {
      throw createError({ statusCode: 400, statusMessage: `Item ${i + 1}: ordem inválida.` })
    }
    return { produto_id, ordem }
  })
}

/**
 * POST /api/produtos/termos-de-pesquisa/reordenar-produtos
 * Atualiza `ordem` em `produto_termo_de_pesquisa_vinculo` para um termo.
 */
export default defineEventHandler(async (event): Promise<ProdutosVinculoReordenarResponse> => {
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
  const termoId = parsePositiveInt(body.termo_id, 'termo_id')
  const itens = parseItens(body.itens)
  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: termoRow, error: termoErr } = await admin
    .from('produto_termo_de_pesquisa')
    .select('id')
    .eq('id', termoId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (termoErr) {
    throw createError({ statusCode: 500, statusMessage: termoErr.message })
  }
  if (!termoRow) {
    throw createError({ statusCode: 404, statusMessage: 'Termo não encontrado neste workspace.' })
  }

  let atualizados = 0
  for (const item of itens) {
    const { data: row, error: upErr } = await admin
      .from('produto_termo_de_pesquisa_vinculo')
      .update({ ordem: item.ordem })
      .eq('termo_id', termoId)
      .eq('produto_id', item.produto_id)
      .select('produto_id')
      .maybeSingle()

    if (upErr) {
      throw createError({ statusCode: 500, statusMessage: upErr.message })
    }
    if (row) atualizados += 1
  }

  return { atualizados }
})
