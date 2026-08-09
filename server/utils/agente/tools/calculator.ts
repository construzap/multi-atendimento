/**
 * Calculadora local (espelha @n8n/n8n-nodes-langchain.toolCalculator).
 * Aceita apenas dígitos e operadores aritméticos básicos.
 */
export function executeCalculator(expression: string): string {
  const expr = String(expression ?? '').trim()
  if (!expr) {
    return 'Erro: expressão vazia.'
  }
  if (!/^[0-9+\-*/().%\s]+$/.test(expr)) {
    return 'Erro: expressão inválida. Use apenas números e + - * / ( ) % .'
  }

  try {
    // Expressão já sanitizada pelo regex acima.
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr})`)()
    if (typeof result !== 'number' || !Number.isFinite(result)) {
      return 'Erro: resultado não numérico.'
    }
    return String(result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return `Erro ao calcular: ${msg}`
  }
}
