/** Telefone WhatsApp BR: 55 + DDD + número (12 ou 13 dígitos). */
export const TELEFONE_NOTIFICACAO_REGEX = /^[0-9]{12,13}$/

/** Grupo WhatsApp (ex.: `120363424086989112@g.us`). */
export const GRUPO_WHATSAPP_NOTIFICACAO_REGEX = /^[0-9]+@g\.us$/

/** Pattern HTML para `BaseInput` (telefone ou grupo). */
export const PATTERN_DESTINO_NOTIFICACAO = '^([0-9]{12,13}|[0-9]+@g\\.us)$'

export const MENSAGEM_DESTINO_NOTIFICACAO_INVALIDO =
  'Formato inválido. Use telefone (ex.: 557199293684) ou grupo WhatsApp (ex.: 120363424086989112@g.us).'

export function ehDestinoNotificacaoValido(valor: string): boolean {
  const trimmed = valor.trim()
  if (!trimmed.length) return false
  return TELEFONE_NOTIFICACAO_REGEX.test(trimmed) || GRUPO_WHATSAPP_NOTIFICACAO_REGEX.test(trimmed)
}
