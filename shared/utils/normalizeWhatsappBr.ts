/**
 * Extrai dígitos de telefone vindos de planilha, formulário ou API.
 * Trata número Excel (`5511999990001`), strings com `.0` (`5511999990001.0`) e formatação comum.
 */
export function extrairDigitosTelefone(input: unknown): string {
  if (input === null || input === undefined) return ''
  if (typeof input === 'number' && Number.isFinite(input)) {
    return String(Math.trunc(input))
  }

  const s = String(input).trim()
  if (!s) return ''

  const compacto = s.replace(/[()\s-]/g, '')
  if (/^\d+\.\d+$/.test(compacto)) {
    const n = Number(compacto)
    if (Number.isFinite(n) && n > 0) {
      return String(Math.trunc(n))
    }
  }

  return s.replace(/\D/g, '')
}

/**
 * Garante DDI `55` quando o usuário digita só DDD + número (10 ou 11 dígitos),
 * depois aplica `normalizeWhatsappBr` (9º dígito).
 *
 * - `(11) 99999-0001` → `5511999990001` → regra do 9º dígito se aplicável.
 * - Já com `55…` mantém e só normaliza.
 * - Outros formatos (só dígitos): repassa para `normalizeWhatsappBr` sem prefixar.
 */
export function normalizeTelefoneBrParaEnvio(input: unknown): string {
  let digits = extrairDigitosTelefone(input)
  if (!digits) return ''

  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
    digits = `55${digits}`
  }

  return normalizeWhatsappBr(digits)
}

/** Valida telefone já normalizado para gravação em `conversas.phone`. */
export function telefoneContatoNormalizadoValido(digits: string): boolean {
  if (!digits) return false
  if (digits.startsWith('55')) {
    return digits.length === 12 || digits.length === 13
  }
  return digits.length >= 10
}

/**
 * Normaliza e valida telefone de contato/conversa.
 * Retorna string vazia se inválido ou vazio.
 */
export function normalizarTelefoneContatoParaGravacao(input: unknown): string {
  const normalized = normalizeTelefoneBrParaEnvio(input)
  return telefoneContatoNormalizadoValido(normalized) ? normalized : ''
}

/**
 * Normaliza números do WhatsApp (BR) para o caso do "9º dígito".
 *
 * Regra pedida:
 * - Se DDI for Brasil (começa com 55) e DDD > 28, remove o "9" logo após o DDD.
 * - Se DDD <= 28, mantém como veio.
 *
 * Ex.:
 * - 5541991338055 -> 554191338055 (DDD 41 > 28, remove 9)
 */
export function normalizeWhatsappBr(input: string): string {
  const digits = extrairDigitosTelefone(input)
  if (!digits.startsWith('55')) return digits

  // Formato mais comum do BR no WhatsApp: 55 + DDD(2) + 9 + número(8) = 13 dígitos.
  if (digits.length !== 13) return digits

  const ddd = Number.parseInt(digits.slice(2, 4), 10)
  if (!Number.isFinite(ddd)) return digits

  // Se DDD > 28 e existe "9" como 1º dígito do número, remove.
  if (ddd > 28 && digits[4] === '9') {
    return digits.slice(0, 4) + digits.slice(5)
  }

  return digits
}
