import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { ProdutosFotosExcluirResponse } from '#shared/types/produtos'
import { deleteFromB2 } from '../../../utils/b2Storage'
import {
  extrairChaveB2DeUrlPublica,
  MAX_FOTOS_POR_REQUISICAO,
  resolverBucketProdutoFotos,
} from '../../../utils/blackblaze-produto-fotos'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { getAuthUserId } from '../../../utils/getAuthUserId'
import {
  assertProdutoNoWorkspace,
  parseProdutoId,
  parseWorkspaceId,
} from '../../../utils/produtoImagensDb'

type Body = {
  workspace_id?: unknown
  produto_id?: unknown
  ids?: unknown
}

function parseIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) {
    throw createError({ statusCode: 400, statusMessage: 'Envie `ids` como array.' })
  }
  const ids = raw
    .map((x) => (typeof x === 'number' ? Math.trunc(x) : Number.parseInt(String(x ?? ''), 10)))
    .filter((n) => Number.isFinite(n) && n >= 1)
  const uniq = [...new Set(ids)]
  if (!uniq.length) {
    throw createError({ statusCode: 400, statusMessage: 'Informe ao menos um id válido.' })
  }
  if (uniq.length > MAX_FOTOS_POR_REQUISICAO) {
    throw createError({
      statusCode: 400,
      statusMessage: `No máximo ${MAX_FOTOS_POR_REQUISICAO} ids por requisição.`,
    })
  }
  return uniq
}

/**
 * POST /api/produtos/fotosblackblaze/excluir
 * Até 10 imagens: remove do B2 (se URL do bucket) e apaga de `produto_imagens`.
 */
export default defineEventHandler(async (event): Promise<ProdutosFotosExcluirResponse> => {
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
  const ids = parseIds(body.ids)
  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)
  await assertProdutoNoWorkspace(admin, workspaceId, produtoId)

  const { data: rows, error: selErr } = await admin
    .from('produto_imagens')
    .select('id, imagem_url')
    .eq('workspace_id', workspaceId)
    .eq('produto_id', produtoId)
    .in('id', ids)

  if (selErr) {
    throw createError({ statusCode: 500, statusMessage: selErr.message })
  }

  const config = useRuntimeConfig()
  const bucket = resolverBucketProdutoFotos(String(config.b2ProdutosBucketName ?? ''))

  for (const row of rows ?? []) {
    const url = String((row as { imagem_url?: unknown }).imagem_url ?? '').trim()
    if (!url) continue
    const key = extrairChaveB2DeUrlPublica(url, bucket)
    if (key) {
      try {
        await deleteFromB2(key, bucket)
      } catch {
        /* continua removendo do banco */
      }
    }
  }

  const { data: deleted, error: delErr } = await admin
    .from('produto_imagens')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('produto_id', produtoId)
    .in('id', ids)
    .select('id')

  if (delErr) {
    throw createError({ statusCode: 500, statusMessage: delErr.message })
  }

  const removidos = (deleted ?? []).length
  const idsRemovidos = (deleted ?? [])
    .map((r: { id?: unknown }) => (typeof r.id === 'number' ? r.id : Number(r.id)))
    .filter((n: number) => Number.isFinite(n))

  return { removidos, ids: idsRemovidos }
})
