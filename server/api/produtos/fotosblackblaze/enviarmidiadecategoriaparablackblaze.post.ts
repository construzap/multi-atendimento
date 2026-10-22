import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type {
  EnviarMidiaCategoriaBlackblazeResponse,
  ProdutoTermoMidiaItem,
} from '#shared/types/produtos'
import { uploadToB2 } from '../../../utils/b2Storage'
import {
  chaveObjetoCategoriaMidia,
  MAX_BYTES_MIDIA_CATEGORIA,
  MAX_MIDIAS_CATEGORIA_POR_REQUISICAO,
  mensagemErroB2ProdutoFotos,
  normalizarMimeMidiaCategoria,
  resolverBucketProdutoFotos,
  tipoMidiaCategoria,
} from '../../../utils/blackblaze-produto-fotos'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { getAuthUserId } from '../../../utils/getAuthUserId'
import { parseWorkspaceId } from '../../../utils/produtoImagensDb'
import { mapMidiasTermo } from '../../../utils/produtoTermosPesquisa'

type ItemUpload = {
  mime?: unknown
  data_base64?: unknown
  filename?: unknown
}

type Body = {
  workspace_id?: unknown
  termo_id?: unknown
  itens?: unknown
}

function parseTermoId(raw: unknown): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'termo_id inválido.' })
  }
  return n
}

/**
 * POST /api/produtos/fotosblackblaze/enviarmidiadecategoriaparablackblaze
 * Envia imagem, PDF ou vídeo ao bucket de fotos de produto, devolve as URLs públicas
 * e acrescenta essas URLs em `produto_termo_de_pesquisa.midias`.
 */
export default defineEventHandler(async (event): Promise<EnviarMidiaCategoriaBlackblazeResponse> => {
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
  const termoId = parseTermoId(body.termo_id)
  await checkWorkspace(event, workspaceId, userId)

  const itensRaw = body.itens
  if (!Array.isArray(itensRaw) || !itensRaw.length) {
    throw createError({ statusCode: 400, statusMessage: 'Envie `itens` com pelo menos um arquivo.' })
  }
  if (itensRaw.length > MAX_MIDIAS_CATEGORIA_POR_REQUISICAO) {
    throw createError({
      statusCode: 400,
      statusMessage: `No máximo ${MAX_MIDIAS_CATEGORIA_POR_REQUISICAO} arquivos por requisição.`,
    })
  }

  const admin = serverSupabaseServiceRole<any>(event)
  const { data: termo, error: termoErr } = await admin
    .from('produto_termo_de_pesquisa')
    .select('id, midias')
    .eq('id', termoId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (termoErr) {
    throw createError({ statusCode: 500, statusMessage: termoErr.message })
  }
  if (!termo) {
    throw createError({ statusCode: 404, statusMessage: 'Categoria não encontrada neste workspace.' })
  }

  const config = useRuntimeConfig()
  const bucket = resolverBucketProdutoFotos(String(config.b2ProdutosBucketName ?? ''))
  const midias: ProdutoTermoMidiaItem[] = []

  for (let i = 0; i < itensRaw.length; i += 1) {
    const item = itensRaw[i] as ItemUpload
    const mime = normalizarMimeMidiaCategoria(String(item.mime ?? '').trim())
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

    if (buffer.length <= 0 || buffer.length > MAX_BYTES_MIDIA_CATEGORIA) {
      throw createError({
        statusCode: 413,
        statusMessage: `Item ${i + 1}: arquivo muito grande (máx 40MB).`,
      })
    }

    const nomeRaw = typeof item.filename === 'string' ? item.filename.trim() : ''
    const nome = (nomeRaw || 'arquivo').slice(0, 240)
    const key = chaveObjetoCategoriaMidia(workspaceId, termoId, mime)

    let url: string
    try {
      url = await uploadToB2(buffer, key, mime, bucket)
    } catch (e) {
      throw createError({
        statusCode: 500,
        statusMessage: mensagemErroB2ProdutoFotos(e, bucket),
      })
    }

    midias.push({
      url,
      nome,
      tipo: tipoMidiaCategoria(mime),
    })
  }

  const atuais = mapMidiasTermo((termo as Record<string, unknown>).midias)
  const urls = new Set(atuais.map((item) => item.url))
  const acrescentar = midias.filter((item) => !urls.has(item.url))
  if (acrescentar.length) {
    const { error: upErr } = await admin
      .from('produto_termo_de_pesquisa')
      .update({ midias: [...atuais, ...acrescentar] })
      .eq('id', termoId)
      .eq('workspace_id', workspaceId)

    if (upErr) {
      throw createError({ statusCode: 500, statusMessage: upErr.message })
    }
  }

  return { midias }
})
