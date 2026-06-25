import { createError } from 'h3'
import { uploadToB2 } from './b2Storage'
import {
  chaveObjetoDisparoEmMassaMidia,
  resolverBucketDisparoEmMassa,
  validarMimePorTipoMensagem,
  type DisparoEmMassaMidiaTipoUpload,
} from './blackblaze-disparo-em-massa'

export async function uploadMidiaDisparoEmMassa(payload: {
  workspaceId: number
  mensagem_type: DisparoEmMassaMidiaTipoUpload
  mime: string
  data_base64: string
}): Promise<string> {
  const mime = validarMimePorTipoMensagem(payload.mensagem_type, payload.mime)

  const rawB64 = payload.data_base64.trim()
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

  const maxBytes = 20 * 1024 * 1024
  if (buffer.length <= 0 || buffer.length > maxBytes) {
    throw createError({ statusCode: 413, statusMessage: 'Arquivo muito grande (máx 20MB).' })
  }

  const config = useRuntimeConfig()
  const bucket = resolverBucketDisparoEmMassa(String(config.b2DisparoEmMassaBucketName ?? ''))
  const key = chaveObjetoDisparoEmMassaMidia(payload.workspaceId, payload.mensagem_type, mime)

  try {
    return await uploadToB2(buffer, key, mime, bucket)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha no upload para o B2.'
    throw createError({ statusCode: 500, statusMessage: msg })
  }
}
