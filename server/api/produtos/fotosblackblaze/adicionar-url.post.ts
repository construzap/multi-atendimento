import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { ProdutosFotosUploadResponse } from '#shared/types/produtos'
import { MAX_FOTOS_POR_REQUISICAO } from '../../../utils/blackblaze-produto-fotos'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { getAuthUserId } from '../../../utils/getAuthUserId'
import {
  assertProdutoNoWorkspace,
  mapProdutoImagemRow,
  parseProdutoId,
  parseWorkspaceId,
} from '../../../utils/produtoImagensDb'

type ItemUrl = {
  imagem_url?: unknown
  ordem?: unknown
}

type Body = {
  workspace_id?: unknown
  produto_id?: unknown
  itens?: unknown
}

function parseOrdem(raw: unknown, fallback: number): number {
  const n = typeof raw === 'number' ? Math.trunc(raw) : Number.parseInt(String(raw ?? ''), 10)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

/**
 * POST /api/produtos/fotosblackblaze/adicionar-url
 * Até 10 URLs externas (sem upload B2) em `produto_imagens`.
 */
export default defineEventHandler(async (event): Promise<ProdutosFotosUploadResponse> => {
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
  await checkWorkspace(event, workspaceId, userId)

  const itensRaw = body.itens
  if (!Array.isArray(itensRaw) || !itensRaw.length) {
    throw createError({ statusCode: 400, statusMessage: 'Envie `itens` com pelo menos uma URL.' })
  }
  if (itensRaw.length > MAX_FOTOS_POR_REQUISICAO) {
    throw createError({
      statusCode: 400,
      statusMessage: `No máximo ${MAX_FOTOS_POR_REQUISICAO} itens por requisição.`,
    })
  }

  const admin = serverSupabaseServiceRole<any>(event)
  await assertProdutoNoWorkspace(admin, workspaceId, produtoId)

  const inseridas: ReturnType<typeof mapProdutoImagemRow>[] = []

  for (let i = 0; i < itensRaw.length; i += 1) {
    const item = itensRaw[i] as ItemUrl
    const imagem_url = String(item.imagem_url ?? '').trim()
    if (!imagem_url || (!imagem_url.startsWith('http://') && !imagem_url.startsWith('https://'))) {
      throw createError({ statusCode: 400, statusMessage: `Item ${i + 1}: URL inválida.` })
    }
    const ordem = parseOrdem(item.ordem, i)

    const { data: row, error: insErr } = await admin
      .from('produto_imagens')
      .insert({
        workspace_id: workspaceId,
        produto_id: produtoId,
        imagem_url,
        ordem,
      })
      .select('id, produto_id, imagem_url, ordem, workspace_id, created_at')
      .single()

    if (insErr) {
      throw createError({ statusCode: 500, statusMessage: insErr.message })
    }
    if (!row || typeof row !== 'object') {
      throw createError({ statusCode: 500, statusMessage: 'Resposta inválida ao inserir imagem.' })
    }
    inseridas.push(mapProdutoImagemRow(row as Record<string, unknown>))
  }

  return { inseridas: inseridas.length, data: inseridas }
})
