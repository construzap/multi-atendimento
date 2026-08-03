import { serverSupabaseClient } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import { uploadToB2 } from '../../utils/b2Storage'
import {
  chaveObjetoAnotacaoMidia,
  inferirTipoMidiaPorMime,
  resolverBucketAnotacoes,
  validarMimeAnotacao,
  type AnotacaoMidiaTipoUpload,
} from '../../utils/blackblaze-anotacoes-conversas'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

type Body = {
  workspace_id?: unknown
  tipo_anotacao?: unknown
  mime?: unknown
  data_base64?: unknown
  filename?: unknown
}

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

function parseTipoMidia(raw: unknown, mime: string): AnotacaoMidiaTipoUpload {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s === 'imagem' || s === 'audio' || s === 'video' || s === 'documento') return s
  const inferido = inferirTipoMidiaPorMime(mime)
  if (inferido) return inferido
  throw createError({
    statusCode: 400,
    statusMessage: 'tipo_anotacao deve ser imagem, audio, video ou documento.',
  })
}

function safeMime(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : ''
  return (s.split(';')[0] ?? '').trim().toLowerCase()
}

/**
 * POST /api/anotacoes_conversas/upload-midia
 *
 * Envia mídia ao Backblaze B2 (bucket `multiatendimentoconstruzap`,
 * pasta `anotacoes_das_conversas/`) e devolve a URL pública para `media_url`.
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

  const mimeIn = safeMime(body.mime)
  const tipo = parseTipoMidia(body.tipo_anotacao, mimeIn)
  const mime = validarMimeAnotacao(tipo, mimeIn)

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
  const bucket = resolverBucketAnotacoes(String(config.b2AnotacoesBucketName ?? ''))
  const key = chaveObjetoAnotacaoMidia(workspaceId, tipo, mime)

  let url: string
  try {
    url = await uploadToB2(buffer, key, mime, bucket)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha no upload para o B2.'
    throw createError({ statusCode: 500, statusMessage: msg })
  }

  const filename =
    typeof body.filename === 'string' && body.filename.trim() ? body.filename.trim() : null

  return {
    ok: true as const,
    url,
    key,
    filename,
    mime,
    tipo_anotacao: tipo,
    size: buffer.length,
  }
})
