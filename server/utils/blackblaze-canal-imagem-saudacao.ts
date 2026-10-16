import { createError } from 'h3'
import { mimeToExt } from './b2Storage'

/** Bucket público para arquivos gerais do canal (imagem de saudação). */
export const CANAL_GERAL_B2_BUCKET = 'geral-'

const MIMES_IMAGEM = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export function normalizarMimeImagemCanal(s: string): string {
  const m = (s.split(';')[0] ?? '').trim().toLowerCase()
  if (!m || !MIMES_IMAGEM.has(m)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'MIME não permitido (use jpeg, png, webp ou gif).',
    })
  }
  return m
}

export function chaveObjetoImagemSaudacao(workspaceId: number, mime: string): string {
  const ext = mimeToExt(mime)
  const rand = Math.random().toString(36).slice(2, 10)
  return `imagem-saudacao/${workspaceId}/${Date.now()}_${rand}${ext}`
}

export function mensagemErroB2CanalGeral(erro: unknown, bucket: string): string {
  const raw = erro instanceof Error ? erro.message : String(erro ?? '')
  const lower = raw.toLowerCase()
  if (lower.includes('not entitled') || lower.includes('access denied') || lower.includes('403')) {
    return (
      `A chave B2 (NUXT_B2_KEY_ID) não tem permissão de escrita no bucket «${bucket}». ` +
      'No painel Backblaze: crie o bucket «geral-» e libere read/write nessa Application Key.'
    )
  }
  if (lower.includes('nosuchbucket') || lower.includes('no such bucket')) {
    return `O bucket B2 «${bucket}» não existe na conta. Crie-o no painel Backblaze.`
  }
  return raw || 'Falha no upload para o B2.'
}
