import { createError } from 'h3'
import { mimeToExt } from './b2Storage'

/** Bucket público para mídia de mensagens prontas (override: `NUXT_B2_MENSAGEM_PRONTAS_BUCKET_NAME`). */
export const MENSAGEM_PRONTAS_B2_BUCKET_PADRAO = 'mensagemprontas'

const MIMES_IMAGEM = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

/** Stickers WhatsApp: preferencialmente WebP; PNG também aceito. */
const MIMES_FIGURINHA = new Set(['image/webp', 'image/png'])

const MIMES_AUDIO = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/aac',
  'audio/flac',
])

const MIMES_VIDEO = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
  'video/3gpp',
])

const MIMES_DOCUMENTO = new Set([
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
])

export type MensagemProntaMidiaTipoUpload =
  | 'imagem'
  | 'audio'
  | 'video'
  | 'documento'
  | 'figurinha'

export function resolverBucketMensagemProntas(b2MensagemProntasBucketName: string | undefined): string {
  const t = String(b2MensagemProntasBucketName ?? '').trim()
  return t.length > 0 ? t : MENSAGEM_PRONTAS_B2_BUCKET_PADRAO
}

export function normalizarMimeUpload(s: string): string {
  return (s.split(';')[0] ?? '').trim().toLowerCase()
}

export function validarMimeMensagemPronta(
  tipo: MensagemProntaMidiaTipoUpload,
  mime: string,
): string {
  const m = normalizarMimeUpload(mime)
  if (!m) {
    throw createError({ statusCode: 400, statusMessage: 'mime inválido.' })
  }
  if (tipo === 'imagem' && !MIMES_IMAGEM.has(m)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'MIME não permitido para imagem (use jpeg, png, webp ou gif).',
    })
  }
  if (tipo === 'figurinha' && !MIMES_FIGURINHA.has(m)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'MIME não permitido para figurinha (use webp ou png).',
    })
  }
  if (tipo === 'audio' && !MIMES_AUDIO.has(m)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'MIME não permitido para áudio.',
    })
  }
  if (tipo === 'video' && !MIMES_VIDEO.has(m)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'MIME não permitido para vídeo.',
    })
  }
  if (tipo === 'documento' && !MIMES_DOCUMENTO.has(m)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'MIME não permitido para documento (PDF, TXT, Word, Excel, PowerPoint).',
    })
  }
  return m
}

function pastaPorTipo(tipo: MensagemProntaMidiaTipoUpload): string {
  if (tipo === 'imagem') return 'imagens'
  if (tipo === 'figurinha') return 'figurinhas'
  if (tipo === 'audio') return 'audios'
  if (tipo === 'video') return 'videos'
  return 'documentos'
}

export function chaveObjetoMensagemPronta(
  workspaceId: number,
  tipo: MensagemProntaMidiaTipoUpload,
  mime: string,
): string {
  const ext = mimeToExt(mime)
  const rand = Math.random().toString(36).slice(2, 10)
  return `mensagens-prontas/${workspaceId}/${pastaPorTipo(tipo)}/${Date.now()}_${rand}${ext}`
}
