/**
 * Garante DDI `55` quando o usuário digita só DDD + número (10 ou 11 dígitos),
 * depois aplica `normalizeWhatsappBr` (9º dígito).
 *
 * - `(11) 99999-0001` → `5511999990001` → regra do 9º dígito se aplicável.
 * - Já com `55…` mantém e só normaliza.
 * - Outros formatos (só dígitos): repassa para `normalizeWhatsappBr` sem prefixar.
 */
export function normalizeTelefoneBrParaEnvio(input: string): string {
  let digits = String(input ?? '').replace(/\D/g, '')
  if (!digits) return ''

  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
    digits = `55${digits}`
  }

  return normalizeWhatsappBr(digits)
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
  const digits = String(input ?? '').replace(/\D/g, '')
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
