import { createError } from 'h3'
import type { CanalFollowUpTipoMidia } from '#shared/types/canal'
import { mimeToExt } from './b2Storage'
import { CANAL_GERAL_B2_BUCKET } from './blackblaze-canal-imagem-saudacao'

export { CANAL_GERAL_B2_BUCKET }

const MIMES_POR_TIPO: Record<Exclude<CanalFollowUpTipoMidia, 'texto'>, Set<string>> = {
  image: new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']),
  video: new Set(['video/mp4']),
  document: new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
  ]),
  /** Qualquer áudio sobe e fica tipado como PTT. */
  ptt: new Set([
    'audio/mpeg',
    'audio/mp3',
    'audio/ogg',
    'audio/opus',
    'audio/wav',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
    'audio/x-m4a',
    'audio/m4a',
  ]),
  sticker: new Set(['image/webp', 'image/png']),
}

export function normalizarMimeFollowUpMidia(
  tipo: CanalFollowUpTipoMidia,
  mimeRaw: string,
): string {
  if (tipo === 'texto') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Tipo texto não envia arquivo ao Blackblaze.',
    })
  }
  const mime = (mimeRaw.split(';')[0] ?? '').trim().toLowerCase()
  const allowed = MIMES_POR_TIPO[tipo]
  if (!mime || !allowed.has(mime)) {
    throw createError({
      statusCode: 400,
      statusMessage: `MIME «${mime || '(vazio)'}» não permitido para o tipo «${tipo}».`,
    })
  }
  return mime
}

export function chaveObjetoFollowUpMidia(
  workspaceId: number,
  tipo: CanalFollowUpTipoMidia,
  mime: string,
): string {
  const ext = mimeToExt(mime)
  const rand = Math.random().toString(36).slice(2, 10)
  return `followup-midia/${workspaceId}/${tipo}/${Date.now()}_${rand}${ext}`
}
