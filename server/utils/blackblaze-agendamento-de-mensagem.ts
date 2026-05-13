import { createError } from 'h3'
import { mimeToExt } from './b2Storage'

/** Bucket público pedido para mídia de agendamentos (override: `NUXT_B2_AGENDAMENTO_BUCKET_NAME`). */
export const AGENDAMENTO_MIDIA_B2_BUCKET_PADRAO = 'multiatendimentoconstruzap'

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

export type AgendamentoMidiaTipoUpload = 'imagem' | 'audio'

export function resolverBucketAgendamentoMidia(b2AgendamentoBucketName: string | undefined): string {
  const t = String(b2AgendamentoBucketName ?? '').trim()
  return t.length > 0 ? t : AGENDAMENTO_MIDIA_B2_BUCKET_PADRAO
}

export function normalizarMimeUpload(s: string): string {
  return (s.split(';')[0] ?? '').trim().toLowerCase()
}

export function validarMimePorTipoMensagem(
  mensagem_type: AgendamentoMidiaTipoUpload,
  mime: string,
): string {
  const m = normalizarMimeUpload(mime)
  if (!m) {
    throw createError({ statusCode: 400, statusMessage: 'mime inválido.' })
  }
  if (mensagem_type === 'imagem' && !MIMES_IMAGEM.has(m)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'MIME não permitido para imagem (use jpeg, png, webp ou gif).',
    })
  }
  if (mensagem_type === 'audio' && !MIMES_AUDIO.has(m)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'MIME não permitido para áudio.',
    })
  }
  return m
}

export function chaveObjetoAgendamentoMidia(
  workspaceId: number,
  mensagem_type: AgendamentoMidiaTipoUpload,
  mime: string,
): string {
  const ext = mimeToExt(mime)
  const rand = Math.random().toString(36).slice(2, 10)
  const pasta = mensagem_type === 'imagem' ? 'imagens' : 'audios'
  return `agendamentos-mensagens/${workspaceId}/${pasta}/${Date.now()}_${rand}${ext}`
}
