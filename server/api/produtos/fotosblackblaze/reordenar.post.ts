import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { ProdutosFotosReordenarResponse } from '#shared/types/produtos'
import { MAX_FOTOS_POR_REQUISICAO } from '../../../utils/blackblaze-produto-fotos'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { getAuthUserId } from '../../../utils/getAuthUserId'
import {
  assertProdutoNoWorkspace,
  mapProdutoImagemRow,
  parseProdutoId,
  parseWorkspaceId,
  sincronizarImagemUrlCapaProduto,
} from '../../../utils/produtoImagensDb'

type ItemOrdem = {
  id?: unknown
  ordem?: unknown
}

type Body = {
  workspace_id?: unknown
  produto_id?: unknown
  itens?: unknown
}

function parseItensOrdem(raw: unknown): { id: number; ordem: number }[] {
  if (!Array.isArray(raw) || !raw.length) {
    throw createError({ statusCode: 400, statusMessage: 'Envie `itens` com id e ordem.' })
  }
  if (raw.length > MAX_FOTOS_POR_REQUISICAO) {
    throw createError({
      statusCode: 400,
      statusMessage: `No máximo ${MAX_FOTOS_POR_REQUISICAO} itens por requisição.`,
    })
  }
  return raw.map((x, i) => {
    const rec = x as ItemOrdem
    const id =
      typeof rec.id === 'number' ? Math.trunc(rec.id) : Number.parseInt(String(rec.id ?? ''), 10)
    const ordem =
      typeof rec.ordem === 'number' ? Math.trunc(rec.ordem) : Number.parseInt(String(rec.ordem ?? ''), 10)
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
 * POST /api/produtos/fotosblackblaze/reordenar
 * Até 10 atualizações de `ordem` em `produto_imagens`.
 */
export default defineEventHandler(async (event): Promise<ProdutosFotosReordenarResponse> => {
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
  const produtoId = parseProdutoId(body.produto_id)
  const itens = parseItensOrdem(body.itens)
  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)
  await assertProdutoNoWorkspace(admin, workspaceId, produtoId)

  const atualizadas: ReturnType<typeof mapProdutoImagemRow>[] = []

  for (const item of itens) {
    const { data: row, error: upErr } = await admin
      .from('produto_imagens')
      .update({ ordem: item.ordem })
      .eq('id', item.id)
      .eq('workspace_id', workspaceId)
      .eq('produto_id', produtoId)
      .select('id, produto_id, imagem_url, ordem, workspace_id, created_at')
      .maybeSingle()

    if (upErr) {
      throw createError({ statusCode: 500, statusMessage: upErr.message })
    }
    if (row && typeof row === 'object') {
      atualizadas.push(mapProdutoImagemRow(row as Record<string, unknown>))
    }
  }

  await sincronizarImagemUrlCapaProduto(admin, workspaceId, produtoId)

  return { atualizadas: atualizadas.length, data: atualizadas }
})
