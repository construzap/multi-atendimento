import { serverSupabaseClient } from '#supabase/server'
import type { CanalFollowUpTipoMidia } from '#shared/types/canal'
import { CANAL_FOLLOW_UP_TIPOS_MIDIA } from '#shared/types/canal'
import { assertMethod, createError, readBody } from 'h3'
import { uploadToB2 } from '../../utils/b2Storage'
import {
  CANAL_GERAL_B2_BUCKET,
  mensagemErroB2CanalGeral,
  urlAmigavelImagemSaudacao,
} from '../../utils/blackblaze-canal-imagem-saudacao'
import {
  chaveObjetoFollowUpMidia,
  normalizarMimeFollowUpMidia,
} from '../../utils/blackblaze-canal-followup-midia'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'
import { parseWorkspaceId } from '../../utils/enviarParaIa/parseWorkspaceId'

type Body = {
  workspace_id?: unknown
  tipo?: unknown
  mime?: unknown
  data_base64?: unknown
  filename?: unknown
}

export type EnviarFollowUpMidiaBlackblazeResponse = {
  media_url: string
}

const TIPOS = new Set(CANAL_FOLLOW_UP_TIPOS_MIDIA.map((t) => t.value))

/**
 * POST /api/canais/enviarfollowupmidiaparablackblaze
 * Envia mídia de etapa fixa de follow-up ao bucket `geral-` e devolve a URL pública.
 * Não grava no banco — o cliente coloca a URL em `config_follow_up[n].media_url`.
 */
export default defineEventHandler(
  async (event): Promise<EnviarFollowUpMidiaBlackblazeResponse> => {
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

    const tipoRaw = typeof body.tipo === 'string' ? body.tipo.trim() : ''
    if (!TIPOS.has(tipoRaw) || tipoRaw === 'texto') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Informe um tipo de mídia válido (diferente de texto).',
      })
    }
    const tipo = tipoRaw as CanalFollowUpTipoMidia

    const mime = normalizarMimeFollowUpMidia(tipo, String(body.mime ?? '').trim())
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

    const maxBytes = 25 * 1024 * 1024
    if (buffer.length <= 0 || buffer.length > maxBytes) {
      throw createError({ statusCode: 413, statusMessage: 'Arquivo muito grande (máx 25MB).' })
    }

    const key = chaveObjetoFollowUpMidia(workspaceId, tipo, mime)

    try {
      await uploadToB2(buffer, key, mime, CANAL_GERAL_B2_BUCKET)
      const config = useRuntimeConfig()
      const media_url = urlAmigavelImagemSaudacao(
        CANAL_GERAL_B2_BUCKET,
        key,
        String(config.b2Region ?? ''),
      )
      return { media_url }
    } catch (e) {
      throw createError({
        statusCode: 500,
        statusMessage: mensagemErroB2CanalGeral(e, CANAL_GERAL_B2_BUCKET),
      })
    }
  },
)
