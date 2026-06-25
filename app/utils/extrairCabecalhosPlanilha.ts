import * as XLSX from 'xlsx'

/**
 * Corrige texto que era UTF-8 mas foi interpretado como Latin-1 (ex.: cabeçalhos CSV: "CÃ³digo" → "Código").
 */
export function corrigirMojibakeUtf8(s: string): string {
  if (!s || !/Ã.|Â./.test(s)) return s
  try {
    const buf = new Uint8Array(s.length)
    for (let i = 0; i < s.length; i++) buf[i] = s.charCodeAt(i) & 0xff
    const out = new TextDecoder('utf-8', { fatal: false }).decode(buf)
    if (out.includes('\uFFFD')) return s
    return out
  } catch {
    return s
  }
}

export function cellToString(c: unknown): string {
  if (c == null || c === '') return ''
  if (typeof c === 'string') return corrigirMojibakeUtf8(c.trim())
  if (typeof c === 'number' && Number.isFinite(c)) return String(c)
  return corrigirMojibakeUtf8(String(c).trim())
}

function readWorkbookFromBuffer(buf: ArrayBuffer, fileName: string): XLSX.WorkBook {
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
  const buf = await file.arrayBuffer()
  const wb = readWorkbookFromBuffer(buf, file.name)
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
  const buf = await file.arrayBuffer()
  const wb = readWorkbookFromBuffer(buf, file.name)
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
