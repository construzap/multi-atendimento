import { cellToString } from '~/utils/planilhaTexto'

export type ConversaoPrecoId = 'padrao' | 'virgula' | 'ponto' | 'div100' | 'div1000' | 'div10000'

export const CONVERSOES_PRECO: { id: ConversaoPrecoId; label: string }[] = [
  { id: 'padrao', label: 'Como está na planilha' },
  { id: 'virgula', label: 'Vírgula é o decimal (13,69)' },
  { id: 'ponto', label: 'Ponto é o decimal (13.69)' },
  { id: 'div100', label: 'Dividir por 100' },
  { id: 'div1000', label: 'Dividir por 1.000' },
  { id: 'div10000', label: 'Dividir por 10.000' },
]

export function ehConversaoPrecoId(id: string): id is ConversaoPrecoId {
  return CONVERSOES_PRECO.some((c) => c.id === id)
}

function textoNumero(raw: unknown): string {
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw)
  return cellToString(raw).trim()
}

function parsePadrao(texto: string): number | null {
  const s = texto.trim().replace(/\s/g, '')
  if (!s) return null
  let t = s.replace(/[^\d,.-]/g, '')
  if (!t) return null
  if (t.includes(',') && t.includes('.')) {
    const lastComma = t.lastIndexOf(',')
    const lastDot = t.lastIndexOf('.')
    if (lastComma > lastDot) t = t.replace(/\./g, '').replace(',', '.')
    else t = t.replace(/,/g, '')
  } else if (t.includes(',')) {
    t = t.replace(/\./g, '').replace(',', '.')
  }
  const n = Number.parseFloat(t)
  return Number.isFinite(n) ? n : null
}

function parseForcandoVirgula(texto: string): number | null {
  let t = texto.replace(/[^\d,.-]/g, '')
  if (!t) return null
  const negativo = t.startsWith('-')
  t = t.replace(/-/g, '')
  if (t.includes(',')) {
    t = t.replace(/\./g, '').replace(',', '.')
  } else {
    const pontos = t.match(/\./g)?.length ?? 0
    // `10.5` e `10.50` já são decimais. `1.050` e `1.234.567` são milhar.
    if (pontos > 1 || (pontos === 1 && /\.\d{3}$/.test(t))) t = t.replace(/\./g, '')
  }
  const n = Number.parseFloat(negativo ? `-${t}` : t)
  return Number.isFinite(n) ? n : null
}

function parseForcandoPonto(texto: string): number | null {
  let t = texto.replace(/[^\d,.-]/g, '')
  if (!t) return null
  t = t.replace(/,/g, '')
  const n = Number.parseFloat(t)
  return Number.isFinite(n) ? n : null
}

/** Converte o texto da célula de preço segundo o padrão escolhido no mapeamento. */
export function converterPrecoPlanilha(raw: unknown, conversao: ConversaoPrecoId = 'padrao'): number | null {
  const texto = textoNumero(raw)
  if (!texto) return null
  let n: number | null
  switch (conversao) {
    case 'virgula':
      n = parseForcandoVirgula(texto)
      break
    case 'ponto':
      n = parseForcandoPonto(texto)
      break
    case 'div100':
    case 'div1000':
    case 'div10000': {
      const base = parsePadrao(texto)
      const divisor = conversao === 'div100' ? 100 : conversao === 'div1000' ? 1000 : 10000
      n = base == null ? null : base / divisor
      break
    }
    default:
      n = parsePadrao(texto)
  }
  if (n == null || !Number.isFinite(n) || n < 0) return null
  return n
}

export function formatarPrecoExemplo(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}
