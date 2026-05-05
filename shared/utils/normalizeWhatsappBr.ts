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
