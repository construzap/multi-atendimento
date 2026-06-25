import { serverSupabaseClient } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import {
  chaveObjetoDisparoEmMassaMidia,
  resolverBucketDisparoEmMassa,
  validarMimePorTipoMensagem,
  type DisparoEmMassaMidiaTipoUpload,
} from '../../../utils/blackblaze-disparo-em-massa'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { uploadMidiaDisparoEmMassa } from '../../../utils/disparoEmMassaUploadMidia'
import { getAuthUserId } from '../../../utils/getAuthUserId'

type Body = {
  workspace_id?: unknown
  mensagem_type?: unknown
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

function parseMensagemTipoMidia(raw: unknown): DisparoEmMassaMidiaTipoUpload {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s === 'imagem' || s === 'audio') return s
  throw createError({ statusCode: 400, statusMessage: 'mensagem_type deve ser imagem ou audio.' })
}

function safeMime(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : ''
  return (s.split(';')[0] ?? '').trim().toLowerCase()
}

/**
 * POST /api/kanban/disparo_em_massa/upload-midia
 *
 * Envia imagem ou áudio ao Backblaze B2 (bucket default `multiatendimentoconstruzap`,
 * pasta `disparo-em-massa/`) e devolve a URL pública para a campanha.
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

  const mensagem_type = parseMensagemTipoMidia(body.mensagem_type)
  const mimeIn = safeMime(body.mime)
  validarMimePorTipoMensagem(mensagem_type, mimeIn)

  const rawB64 = typeof body.data_base64 === 'string' ? body.data_base64.trim() : ''
  const url = await uploadMidiaDisparoEmMassa({
    workspaceId,
    mensagem_type,
    mime: mimeIn,
    data_base64: rawB64,
  })

  const config = useRuntimeConfig()
  const bucket = resolverBucketDisparoEmMassa(String(config.b2DisparoEmMassaBucketName ?? ''))
  const mime = validarMimePorTipoMensagem(mensagem_type, mimeIn)
  const key = chaveObjetoDisparoEmMassaMidia(workspaceId, mensagem_type, mime)

  const base64 = rawB64.includes('base64,') ? rawB64.split('base64,')[1] ?? '' : rawB64
  const buffer = Buffer.from(base64, 'base64')
  const filename = typeof body.filename === 'string' && body.filename.trim() ? body.filename.trim() : null

  return { ok: true as const, url, key, filename, mime, size: buffer.length }
})
