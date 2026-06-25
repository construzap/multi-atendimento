import { mimeToExt } from './b2Storage'
import type { AgendamentoMidiaTipoUpload } from './blackblaze-agendamento-de-mensagem'

export {
  normalizarMimeUpload,
  validarMimePorTipoMensagem,
  type AgendamentoMidiaTipoUpload as DisparoEmMassaMidiaTipoUpload,
} from './blackblaze-agendamento-de-mensagem'

/** Bucket público para mídia de disparo em massa (override: `NUXT_B2_DISPARO_EM_MASSA_BUCKET_NAME`). */
export const DISPARO_EM_MASSA_B2_BUCKET_PADRAO = 'multiatendimentoconstruzap'

export function resolverBucketDisparoEmMassa(b2DisparoEmMassaBucketName: string | undefined): string {
  const t = String(b2DisparoEmMassaBucketName ?? '').trim()
  return t.length > 0 ? t : DISPARO_EM_MASSA_B2_BUCKET_PADRAO
}

export function chaveObjetoDisparoEmMassaMidia(
  workspaceId: number,
  mensagem_type: AgendamentoMidiaTipoUpload,
  mime: string,
): string {
  const ext = mimeToExt(mime)
  const rand = Math.random().toString(36).slice(2, 10)
  const pasta = mensagem_type === 'imagem' ? 'imagens' : 'audios'
  return `disparo-em-massa/${workspaceId}/${pasta}/${Date.now()}_${rand}${ext}`
}
