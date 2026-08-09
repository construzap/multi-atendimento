import { serverSupabaseClient } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import { uploadToB2 } from '../../utils/b2Storage'
import {
  chaveObjetoMensagemPronta,
  resolverBucketMensagemProntas,
  validarMimeMensagemPronta,
  type MensagemProntaMidiaTipoUpload,
} from '../../utils/blackblaze-mensagens-prontas'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

type Body = {
  workspace_id?: unknown
  tipo?: unknown
  mime?: unknown
  data_base64?: unknown
  filename?: unknown
}

const TIPOS_MIDIA: MensagemProntaMidiaTipoUpload[] = ['imagem', 'audio', 'video', 'documento']

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

function parseTipoMidia(raw: unknown): MensagemProntaMidiaTipoUpload {
  const s = String(raw ?? '').trim().toLowerCase()
  if ((TIPOS_MIDIA as string[]).includes(s)) return s as MensagemProntaMidiaTipoUpload
  throw createError({
    statusCode: 400,
    statusMessage: `tipo deve ser: ${TIPOS_MIDIA.join(', ')}.`,
  })
}

function safeMime(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : ''
  return (s.split(';')[0] ?? '').trim().toLowerCase()
}

/**
 * POST /api/mensagens_prontas/upload-midia
 *
 * Envia imagem, áudio, vídeo ou documento ao Backblaze B2
 * (bucket `mensagemprontas` via `NUXT_B2_MENSAGEM_PRONTAS_BUCKET_NAME`)
 * e devolve a URL pública para gravar em `conteudo` do passo.
 */
export default defineEventHandler(async (event) => {
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

  const tipo = parseTipoMidia(body.tipo)
  const mimeIn = safeMime(body.mime)
  const mime = validarMimeMensagemPronta(tipo, mimeIn)

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

  const maxBytes = 40 * 1024 * 1024
  if (buffer.length <= 0 || buffer.length > maxBytes) {
    throw createError({ statusCode: 413, statusMessage: 'Arquivo muito grande (máx 40MB).' })
  }

  const config = useRuntimeConfig()
  const bucket = resolverBucketMensagemProntas(String(config.b2MensagemProntasBucketName ?? ''))
  const key = chaveObjetoMensagemPronta(workspaceId, tipo, mime)

  let url: string
  try {
    url = await uploadToB2(buffer, key, mime, bucket)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha no upload para o B2.'
    throw createError({ statusCode: 500, statusMessage: msg })
  }

  const filename = typeof body.filename === 'string' && body.filename.trim() ? body.filename.trim() : null

  return { ok: true as const, url, key, filename, mime, size: buffer.length }
})
