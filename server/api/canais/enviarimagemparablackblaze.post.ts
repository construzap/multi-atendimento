import { serverSupabaseClient } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import { uploadToB2 } from '../../utils/b2Storage'
import {
  CANAL_GERAL_B2_BUCKET,
  chaveObjetoImagemSaudacao,
  mensagemErroB2CanalGeral,
  normalizarMimeImagemCanal,
  urlAmigavelImagemSaudacao,
} from '../../utils/blackblaze-canal-imagem-saudacao'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'
import { parseWorkspaceId } from '../../utils/enviarParaIa/parseWorkspaceId'

type Body = {
  workspace_id?: unknown
  mime?: unknown
  data_base64?: unknown
  filename?: unknown
}

export type EnviarImagemCanalBlackblazeResponse = {
  imagem_url: string
}

/**
 * POST /api/canais/enviarimagemparablackblaze
 * Envia uma imagem ao bucket `geral-` e devolve a URL pública.
 * Não grava no banco — o cliente usa a URL em criarcanal / editarcanal (`imagem_saudacao`).
 */
export default defineEventHandler(async (event): Promise<EnviarImagemCanalBlackblazeResponse> => {
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
  await checkWorkspace(event, workspaceId, userId)

  const mime = normalizarMimeImagemCanal(String(body.mime ?? '').trim())
  const rawB64 = typeof body.data_base64 === 'string' ? body.data_base64.trim() : ''
  if (!rawB64) {
    throw createError({ statusCode: 400, statusMessage: 'Informe data_base64.' })
  }
  const base64 = rawB64.includes('base64,') ? rawB64.split('base64,')[1] ?? '' : rawB64

  let buffer: Buffer
  try {
    buffer = Buffer.from(base64, 'base64')
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'data_base64 inválido.' })
  }

  const maxBytes = 10 * 1024 * 1024
  if (buffer.length <= 0 || buffer.length > maxBytes) {
    throw createError({ statusCode: 413, statusMessage: 'Arquivo muito grande (máx 10MB).' })
  }

  const key = chaveObjetoImagemSaudacao(workspaceId, mime)

  try {
    await uploadToB2(buffer, key, mime, CANAL_GERAL_B2_BUCKET)
    const config = useRuntimeConfig()
    const imagem_url = urlAmigavelImagemSaudacao(
      CANAL_GERAL_B2_BUCKET,
      key,
      String(config.b2Region ?? ''),
    )
    return { imagem_url }
  } catch (e) {
    throw createError({
      statusCode: 500,
      statusMessage: mensagemErroB2CanalGeral(e, CANAL_GERAL_B2_BUCKET),
    })
  }
})
