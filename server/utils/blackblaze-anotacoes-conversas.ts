import { createError } from 'h3'
import { mimeToExt } from './b2Storage'

/** Bucket público para mídia de anotações (override: `NUXT_B2_ANOTACOES_BUCKET_NAME`). */
export const ANOTACOES_B2_BUCKET_PADRAO = 'multiatendimentoconstruzap'

const MIMES_IMAGEM = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

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
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/mpeg',
])

const MIMES_DOCUMENTO = new Set([
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

/** Tipos de mídia aceitos no upload B2 (sem `texto`). */
export type AnotacaoMidiaTipoUpload = 'imagem' | 'audio' | 'video' | 'documento'

export type AnotacaoTipo = 'texto' | AnotacaoMidiaTipoUpload

export function resolverBucketAnotacoes(b2AnotacoesBucketName: string | undefined): string {
  const t = String(b2AnotacoesBucketName ?? '').trim()
  return t.length > 0 ? t : ANOTACOES_B2_BUCKET_PADRAO
}

export function normalizarMimeAnotacao(s: string): string {
  return (s.split(';')[0] ?? '').trim().toLowerCase()
}

export function inferirTipoMidiaPorMime(mime: string): AnotacaoMidiaTipoUpload | null {
  const m = normalizarMimeAnotacao(mime)
  if (!m) return null
  if (MIMES_IMAGEM.has(m) || m.startsWith('image/')) return 'imagem'
  if (MIMES_AUDIO.has(m) || m.startsWith('audio/')) return 'audio'
  if (MIMES_VIDEO.has(m) || m.startsWith('video/')) return 'video'
  if (MIMES_DOCUMENTO.has(m) || m.startsWith('application/')) return 'documento'
  return null
}

export function validarMimeAnotacao(tipo: AnotacaoMidiaTipoUpload, mime: string): string {
  const m = normalizarMimeAnotacao(mime)
  if (!m) {
    throw createError({ statusCode: 400, statusMessage: 'mime inválido.' })
  }

  const ok =
    (tipo === 'imagem' && (MIMES_IMAGEM.has(m) || m.startsWith('image/'))) ||
    (tipo === 'audio' && (MIMES_AUDIO.has(m) || m.startsWith('audio/'))) ||
    (tipo === 'video' && (MIMES_VIDEO.has(m) || m.startsWith('video/'))) ||
    (tipo === 'documento' &&
      (MIMES_DOCUMENTO.has(m) || m.startsWith('application/') || m === 'text/plain'))

  if (!ok) {
    throw createError({
      statusCode: 400,
      statusMessage: `MIME não permitido para ${tipo}.`,
    })
  }
  return m
}

/**
 * Chave no B2: `anotacoes_das_conversas/{workspaceId}/{tipo}/...`
 */
export function chaveObjetoAnotacaoMidia(
  workspaceId: number,
  tipo: AnotacaoMidiaTipoUpload,
  mime: string,
): string {
  const ext = mimeToExt(mime)
  const rand = Math.random().toString(36).slice(2, 10)
  const pasta =
    tipo === 'imagem'
      ? 'imagens'
      : tipo === 'audio'
        ? 'audios'
        : tipo === 'video'
          ? 'videos'
          : 'documentos'
  return `anotacoes_das_conversas/${workspaceId}/${pasta}/${Date.now()}_${rand}${ext}`
}

/**
 * Extrai a object key de uma URL pública B2 do bucket de anotações.
 * Só aceita chaves em `anotacoes_das_conversas/`.
 */
export function extrairChaveB2AnotacaoDeUrl(url: string, bucket: string): string | null {
  try {
    const u = new URL(url.trim())
    if (!u.hostname.includes('backblazeb2.com')) return null
    const prefix = `${bucket}.s3.`
    if (!u.hostname.startsWith(prefix)) return null
    const raw = u.pathname.replace(/^\//, '')
    if (!raw) return null
    const key = raw.split('/').map((p) => decodeURIComponent(p)).join('/')
    if (!key.startsWith('anotacoes_das_conversas/')) return null
    return key
  } catch {
    return null
  }
}

