import { cellToString } from '~/utils/planilhaTexto'

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
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][]

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
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: options?.raw === true,
  }) as unknown[][]
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
