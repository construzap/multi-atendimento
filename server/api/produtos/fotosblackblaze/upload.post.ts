import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { ProdutosFotosUploadResponse } from '#shared/types/produtos'
import { uploadToB2 } from '../../../utils/b2Storage'
import {
  chaveObjetoProdutoFoto,
  MAX_FOTOS_POR_REQUISICAO,
  mensagemErroB2ProdutoFotos,
  normalizarMimeImagemProduto,
  resolverBucketProdutoFotos,
} from '../../../utils/blackblaze-produto-fotos'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { getAuthUserId } from '../../../utils/getAuthUserId'
import {
  assertProdutoNoWorkspace,
  mapProdutoImagemRow,
  parseProdutoId,
  parseWorkspaceId,
} from '../../../utils/produtoImagensDb'

type ItemUpload = {
  mime?: unknown
  data_base64?: unknown
  ordem?: unknown
  filename?: unknown
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
 * POST /api/produtos/fotosblackblaze/upload
 * Até 10 imagens: envia ao B2 e insere em `produto_imagens`.
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
    throw createError({ statusCode: 400, statusMessage: 'Envie `itens` com pelo menos uma imagem.' })
  }
  if (itensRaw.length > MAX_FOTOS_POR_REQUISICAO) {
    throw createError({
      statusCode: 400,
      statusMessage: `No máximo ${MAX_FOTOS_POR_REQUISICAO} imagens por requisição.`,
    })
  }

  const admin = serverSupabaseServiceRole<any>(event)
  await assertProdutoNoWorkspace(admin, workspaceId, produtoId)

  const config = useRuntimeConfig()
  const bucket = resolverBucketProdutoFotos(String(config.b2ProdutosBucketName ?? ''))

  const inseridas: ReturnType<typeof mapProdutoImagemRow>[] = []

  for (let i = 0; i < itensRaw.length; i += 1) {
    const item = itensRaw[i] as ItemUpload
    const mime = normalizarMimeImagemProduto(String(item.mime ?? '').trim())

    const rawB64 = typeof item.data_base64 === 'string' ? item.data_base64.trim() : ''
    if (!rawB64) {
      throw createError({ statusCode: 400, statusMessage: `Item ${i + 1}: informe data_base64.` })
    }
    const base64 = rawB64.includes('base64,') ? rawB64.split('base64,')[1] ?? '' : rawB64

    let buffer: Buffer
    try {
      buffer = Buffer.from(base64, 'base64')
    } catch {
      throw createError({ statusCode: 400, statusMessage: `Item ${i + 1}: data_base64 inválido.` })
    }

    const maxBytes = 10 * 1024 * 1024
    if (buffer.length <= 0 || buffer.length > maxBytes) {
      throw createError({ statusCode: 413, statusMessage: `Item ${i + 1}: arquivo muito grande (máx 10MB).` })
    }

    const ordem = parseOrdem(item.ordem, i)
    const key = chaveObjetoProdutoFoto(workspaceId, produtoId, mime)

    let imagem_url: string
    try {
      imagem_url = await uploadToB2(buffer, key, mime, bucket)
    } catch (e) {
      throw createError({
        statusCode: 500,
        statusMessage: mensagemErroB2ProdutoFotos(e, bucket),
      })
    }

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
