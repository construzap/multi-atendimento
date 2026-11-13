import { cellToString, formatarNumeroPlanilha, textoFormatadoConfereNumero, corrigirMojibakeUtf8 } from '~/utils/planilhaTexto'

export { cellToString, corrigirMojibakeUtf8 } from '~/utils/planilhaTexto'

/** Carrega SheetJS só quando preciso (cliente / importação de arquivo). */
async function loadXlsx() {
  return import('xlsx')
}

async function readWorkbookFromBuffer(buf: ArrayBuffer, fileName: string) {
  const XLSX = await loadXlsx()
  const lower = fileName.trim().toLowerCase()
  if (lower.endsWith('.csv')) {
    return XLSX.read(buf, { type: 'array', codepage: 65001 })
  }
  return XLSX.read(buf, { type: 'array' })
}

function normalizarPrimeiraLinha(cells: unknown[]): string[] {
  const strs = cells.map((c) => cellToString(c))
  let end = strs.length
  while (end > 0 && strs[end - 1] === '') end--
  return strs.slice(0, Math.max(end, 0))
}

type CelulaPlanilha = {
  t?: string
  v?: unknown
  w?: string
}

/**
 * Texto da célula para o exemplo e para a importação.
 * Código gravado como texto (`06200`) permanece. Número cujo texto formatado
 * não bate com o valor cru (moeda `13,69` virando `R$ 136,900.00`) usa o valor cru.
 */
export function valorCelulaPlanilha(cell: CelulaPlanilha | undefined): unknown {
  if (!cell || cell.v == null || cell.v === '') return ''
  if (cell.t === 's' || cell.t === 'str' || typeof cell.v === 'string') {
    return corrigirMojibakeUtf8(String(cell.v).trim())
  }
  if (typeof cell.v === 'number' && Number.isFinite(cell.v)) {
    const formatado = typeof cell.w === 'string' ? cell.w.trim() : ''
    if (formatado && textoFormatadoConfereNumero(cell.v, formatado)) {
      return corrigirMojibakeUtf8(formatado)
    }
    if (formatado && !/^[\sR$€£]*[-+]?\d[\d.,\s]*$/.test(formatado)) {
      return corrigirMojibakeUtf8(formatado)
    }
    return formatarNumeroPlanilha(cell.v)
  }
  if (typeof cell.w === 'string' && cell.w.trim()) return corrigirMojibakeUtf8(cell.w.trim())
  return corrigirMojibakeUtf8(String(cell.v).trim())
}

function matrizDaFolha(
  XLSX: { utils: { decode_range: (ref: string) => { s: { r: number; c: number }; e: { r: number; c: number } }; encode_cell: (addr: { r: number; c: number }) => string } },
  sheet: Record<string, unknown>,
  modo: 'texto' | 'raw',
): unknown[][] {
  const ref = sheet['!ref']
  if (typeof ref !== 'string' || !ref) return []
  const range = XLSX.utils.decode_range(ref)
  const rows: unknown[][] = []
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: unknown[] = []
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })] as CelulaPlanilha | undefined
      if (modo === 'raw') row.push(cell?.v ?? '')
      else row.push(valorCelulaPlanilha(cell))
    }
    rows.push(row)
  }
  return rows
}

function alinharExemplos(cabecalhosLen: number, segundaLinha: unknown[] | undefined): string[] {
  const out: string[] = []
  for (let i = 0; i < cabecalhosLen; i++) {
    out.push(cellToString(segundaLinha?.[i]))
  }
  return out
}

export type MetadadosPlanilhaImportacao = {
  cabecalhos: string[]
  /** Valores da primeira linha de dados (linha 2 da folha), alinhados aos cabeçalhos. */
  exemplos: string[]
  /** Quantidade de linhas de dados (exclui a linha de cabeçalho). */
  totalLinhasDados: number
}

/**
 * Cabeçalhos (1.ª linha), exemplos (2.ª linha) e contagem de registros da 1.ª folha (CSV / XLS / XLSX).
 */
export async function extrairMetadadosPlanilhaImportacao(file: File): Promise<MetadadosPlanilhaImportacao> {
  const XLSX = await loadXlsx()
  const buf = await file.arrayBuffer()
  const wb = await readWorkbookFromBuffer(buf, file.name)
  const sheetName = wb.SheetNames[0]
  if (!sheetName) {
    return { cabecalhos: [], exemplos: [], totalLinhasDados: 0 }
  }
  const sheet = wb.Sheets[sheetName]
  if (!sheet) {
    return { cabecalhos: [], exemplos: [], totalLinhasDados: 0 }
  }
  const rows = matrizDaFolha(XLSX, sheet as Record<string, unknown>, 'texto')

  const primeira = rows[0]
  if (!primeira || !Array.isArray(primeira)) {
    return { cabecalhos: [], exemplos: [], totalLinhasDados: 0 }
  }

  const cabecalhos = normalizarPrimeiraLinha(primeira)
  const segunda = rows[1]
  const exemplos = alinharExemplos(cabecalhos.length, Array.isArray(segunda) ? segunda : undefined)
  const totalLinhasDados = Math.max(0, rows.length - 1)

  return { cabecalhos, exemplos, totalLinhasDados }
}

/** Só a 1.ª linha (retrocompatível). */
export async function extrairCabecalhosPlanilha(file: File): Promise<string[]> {
  const m = await extrairMetadadosPlanilhaImportacao(file)
  return m.cabecalhos
}

/**
 * Todas as linhas da 1.ª folha (inclui cabeçalho na posição 0).
 * Cada linha é um array de células alinhado ao comprimento da primeira linha (cabeçalhos).
 * `raw: true` preserva números (telefone / id_canal no Excel); padrão `false` mantém texto formatado.
 */
export async function lerTodasLinhasPlanilha(
  file: File,
  options?: { raw?: boolean },
): Promise<unknown[][]> {
  const XLSX = await loadXlsx()
  const buf = await file.arrayBuffer()
  const wb = await readWorkbookFromBuffer(buf, file.name)
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return []
  const sheet = wb.Sheets[sheetName]
  if (!sheet) return []
  const rows = matrizDaFolha(
    XLSX,
    sheet as Record<string, unknown>,
    options?.raw === true ? 'raw' : 'texto',
  )
  if (!rows.length) return []
  const primeira = Array.isArray(rows[0]) ? (rows[0] as unknown[]) : []
  const headerLen = normalizarPrimeiraLinha(primeira).length
  const len = Math.max(headerLen, 1)
  return rows.map((row) => {
    const arr = Array.isArray(row) ? [...row] : []
    while (arr.length < len) arr.push('')
    return arr.slice(0, len)
  })
}
