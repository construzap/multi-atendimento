import type { CampoImportacaoContatoId, ContatoImportarLinha } from '#shared/types/contato'
import { normalizeTelefoneBrParaEnvio, telefoneContatoNormalizadoValido } from '#shared/utils/normalizeWhatsappBr'
import { cellToString } from '~/utils/extrairCabecalhosPlanilha'
import {
  MAPEAMENTO_FUNIL_ATENDENTE_ID,
  MAPEAMENTO_FUNIL_COLUNA_ID,
} from '~/utils/mapeamentoColunasImportacao'

/** Campos mapeáveis na importação (espelha `CAMPOS_OCULTOS_MAPEAMENTO` do Pinia contatos). */
const CAMPOS_SISTEMA = new Set<string>([
  'name',
  'phone',
  'lid',
  'photo',
  'id_canal',
  'created_at',
  'conversa_aberta',
  'name_group',
  'ia_ligada',
  'latitude',
  'longitude',
])

export type DiagnosticoImportacaoContato = {
  totalLidas: number
  linhasVazias: number
  semNome: number
  semTelefone: number
  telefoneInvalido: number
  semCanal: number
  canalInvalido: number
  validas: number
}

export type OpcoesConstruirLinhasContato = {
  /** Nome do canal (lowercase) → id — aceita coluna com nome em vez de número. */
  canaisPorNome?: Map<string, number>
  /** Nome da coluna do funil (lowercase) → id. */
  colunasPorNome?: Map<string, number>
  /** E-mail do atendente (lowercase) → identificador (e-mail ou UUID). */
  atendentesPorEmail?: Map<string, string>
}

export type ResultadoConstruirLinhasContato = {
  linhas: ContatoImportarLinha[]
  diagnostico: DiagnosticoImportacaoContato
}

function parseCampoPersonalizadoId(mapeamentoId: string): number | null {
  if (!mapeamentoId.startsWith('cp:')) return null
  const n = Number.parseInt(mapeamentoId.slice(3), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function indiceMapeado(mapeamento: Record<number, string>, campo: string): number | null {
  for (const [idxStr, fieldId] of Object.entries(mapeamento)) {
    if (fieldId === campo) {
      const idx = Number(idxStr)
      return Number.isFinite(idx) && idx >= 0 ? idx : null
    }
  }
  return null
}

function celulaTemValor(raw: unknown): boolean {
  if (raw === null || raw === undefined) return false
  if (typeof raw === 'number') return Number.isFinite(raw)
  return cellToString(raw).length > 0
}

function parseBool(raw: string): boolean | null {
  const s = raw.trim().toLowerCase()
  if (!s) return null
  if (['0', 'n', 'nao', 'não', 'false', 'f', 'off', 'fechada', 'fechado'].includes(s)) return false
  if (['1', 's', 'sim', 'true', 't', 'on', 'aberta', 'aberto'].includes(s)) return true
  return null
}

function parseDecimal(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, '')
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

function parseIntPos(raw: string): number | null {
  const n = Number.parseInt(raw.trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function parseIdNumericoCelula(
  rawCell: unknown,
  mapaPorNome?: Map<string, number>,
): number | null {
  if (typeof rawCell === 'number' && Number.isFinite(rawCell)) {
    const n = Math.trunc(rawCell)
    if (n > 0) return n
  }

  const str = cellToString(rawCell).trim()
  if (!str) return null

  const soDigitos = str.replace(/\D/g, '')
  if (soDigitos.length && soDigitos.length <= 6) {
    const n = Number.parseInt(soDigitos, 10)
    if (Number.isFinite(n) && n > 0) return n
  }

  const asInt = parseIntPos(str)
  if (asInt != null) return asInt

  if (mapaPorNome) {
    return mapaPorNome.get(str.toLowerCase()) ?? null
  }

  return null
}

function parseIdCanalCelula(rawCell: unknown, canaisPorNome?: Map<string, number>): number | null {
  return parseIdNumericoCelula(rawCell, canaisPorNome)
}

function parseColunaIdCelula(rawCell: unknown, colunasPorNome?: Map<string, number>): number | null {
  return parseIdNumericoCelula(rawCell, colunasPorNome)
}

function parseAtendenteIdCelula(
  rawCell: unknown,
  atendentesPorEmail?: Map<string, string>,
): string | null {
  const str = cellToString(rawCell).trim().toLowerCase()
  if (!str || !atendentesPorEmail) return null
  return atendentesPorEmail.get(str) ?? null
}

function excelSerialParaIso(n: number): string | null {
  if (!Number.isFinite(n) || n < 1) return null
  const utc = Date.UTC(1899, 11, 30) + Math.round(n * 86400000)
  const d = new Date(utc)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function parseDataIso(rawCell: unknown): string | null {
  if (rawCell === null || rawCell === undefined || rawCell === '') return null

  if (typeof rawCell === 'number' && Number.isFinite(rawCell)) {
    if (rawCell > 1e12) return new Date(rawCell).toISOString()
    if (rawCell > 20000 && rawCell < 80000) return excelSerialParaIso(rawCell)
  }

  const str = cellToString(rawCell)
  if (!str) return null

  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str.includes('T') ? str : `${str}T12:00:00.000Z`)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  const br = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (br) {
    const [, dd, mm, yyyy] = br
    const d = new Date(`${yyyy}-${mm!.padStart(2, '0')}-${dd!.padStart(2, '0')}T12:00:00.000Z`)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  const parsed = Date.parse(str)
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString()
}

function normalizarTelefoneCelula(rawCell: unknown): string | null {
  if (rawCell === null || rawCell === undefined || rawCell === '') return null
  const normalizado = normalizeTelefoneBrParaEnvio(rawCell)
  if (!telefoneContatoNormalizadoValido(normalizado)) return null
  return normalizado
}

function valorCelulaParaCampoSistema(
  field: CampoImportacaoContatoId,
  rawCell: unknown,
  canaisPorNome?: Map<string, number>,
): unknown {
  const str = cellToString(rawCell)
  switch (field) {
    case 'phone':
      return normalizarTelefoneCelula(rawCell)
    case 'id_canal':
      return parseIdCanalCelula(rawCell, canaisPorNome)
    case 'created_at':
      return parseDataIso(rawCell)
    case 'latitude':
    case 'longitude':
      return parseDecimal(str)
    case 'conversa_aberta':
    case 'ia_ligada':
      return parseBool(str)
    default:
      return str.length ? str : null
  }
}

function diagnosticoVazio(): DiagnosticoImportacaoContato {
  return {
    totalLidas: 0,
    linhasVazias: 0,
    semNome: 0,
    semTelefone: 0,
    telefoneInvalido: 0,
    semCanal: 0,
    canalInvalido: 0,
    validas: 0,
  }
}

export function mensagemDiagnosticoImportacaoContato(d: DiagnosticoImportacaoContato): string {
  if (d.validas > 0) return ''

  const partes: string[] = []
  partes.push(
    `Nenhuma linha válida em ${d.totalLidas} registro(s) lido(s) da planilha.`,
  )

  if (d.linhasVazias > 0) partes.push(`${d.linhasVazias} linha(s) vazia(s).`)
  if (d.semNome > 0) partes.push(`${d.semNome} sem nome preenchido.`)
  if (d.semTelefone > 0) partes.push(`${d.semTelefone} sem telefone na coluna mapeada.`)
  if (d.telefoneInvalido > 0) {
    partes.push(
      `${d.telefoneInvalido} com telefone incompleto ou inválido (use ex: 5511999990001 ou (11) 99999-0001).`,
    )
  }
  if (d.semCanal > 0) partes.push(`${d.semCanal} sem ID do canal na coluna mapeada.`)
  if (d.canalInvalido > 0) {
    partes.push(
      `${d.canalInvalido} com canal não reconhecido (use o número id do canal ou o nome exato do canal no workspace).`,
    )
  }

  partes.push('Confira o mapeamento de «Nome», «Telefone» e «ID do canal».')
  return partes.join(' ')
}

/**
 * Constrói linhas para `POST /api/contatos/importar` a partir da matriz da folha (linha 0 = cabeçalho).
 */
export function construirLinhasImportacaoContato(
  todasLinhas: unknown[][],
  mapeamentoPorIndice: Record<number, string>,
  options: OpcoesConstruirLinhasContato = {},
): ResultadoConstruirLinhasContato {
  const diagnostico = diagnosticoVazio()
  const out: ContatoImportarLinha[] = []

  if (todasLinhas.length < 2) {
    return { linhas: out, diagnostico }
  }

  const idxPhone = indiceMapeado(mapeamentoPorIndice, 'phone')
  const idxNome = indiceMapeado(mapeamentoPorIndice, 'name')
  const idxCanal = indiceMapeado(mapeamentoPorIndice, 'id_canal')
  const { canaisPorNome, colunasPorNome, atendentesPorEmail } = options

  for (let r = 1; r < todasLinhas.length; r++) {
    const row = todasLinhas[r]
    if (!Array.isArray(row)) continue

    diagnostico.totalLidas += 1

    const temValor = Object.keys(mapeamentoPorIndice).some((idxStr) => {
      const idx = Number(idxStr)
      return Number.isFinite(idx) && celulaTemValor(row[idx])
    })
    if (!temValor) {
      diagnostico.linhasVazias += 1
      continue
    }

    const sistema: Record<string, unknown> = {}
    const camposPersonalizados: ContatoImportarLinha['campos_personalizados'] = []
    let colunaIdFunil: number | null = null
    let atendenteIdFunil: string | null = null

    for (const [idxStr, fieldId] of Object.entries(mapeamentoPorIndice)) {
      const idx = Number(idxStr)
      if (!Number.isFinite(idx) || idx < 0 || !fieldId) continue

      const cpId = parseCampoPersonalizadoId(fieldId)
      if (cpId != null) {
        const val = cellToString(row[idx])
        if (val.length) camposPersonalizados.push({ campo_id: cpId, valor: val })
        continue
      }

      if (fieldId === MAPEAMENTO_FUNIL_COLUNA_ID) {
        const colId = parseColunaIdCelula(row[idx], colunasPorNome)
        if (colId != null) colunaIdFunil = colId
        continue
      }

      if (fieldId === MAPEAMENTO_FUNIL_ATENDENTE_ID) {
        const attId = parseAtendenteIdCelula(row[idx], atendentesPorEmail)
        if (attId) atendenteIdFunil = attId
        continue
      }

      if (!CAMPOS_SISTEMA.has(fieldId)) continue
      const val = valorCelulaParaCampoSistema(
        fieldId as CampoImportacaoContatoId,
        row[idx],
        canaisPorNome,
      )
      if (val !== null && val !== undefined) sistema[fieldId] = val
    }

    const nome = typeof sistema.name === 'string' ? sistema.name.trim() : ''
    if (!nome) {
      if (idxNome != null && !celulaTemValor(row[idxNome])) diagnostico.semNome += 1
      else diagnostico.semNome += 1
      continue
    }

    const phone = typeof sistema.phone === 'string' ? sistema.phone.trim() : ''
    if (!phone) {
      const rawPhone = idxPhone != null ? row[idxPhone] : undefined
      if (!celulaTemValor(rawPhone)) diagnostico.semTelefone += 1
      else diagnostico.telefoneInvalido += 1
      continue
    }

    const idCanalRaw = sistema.id_canal
    const idCanal =
      typeof idCanalRaw === 'number'
        ? idCanalRaw
        : Number.parseInt(String(idCanalRaw ?? ''), 10)
    if (!Number.isFinite(idCanal) || idCanal < 1) {
      const rawCanal = idxCanal != null ? row[idxCanal] : undefined
      if (!celulaTemValor(rawCanal)) diagnostico.semCanal += 1
      else diagnostico.canalInvalido += 1
      continue
    }

    const linha: ContatoImportarLinha = {
      phone,
      id_canal: idCanal,
      name: nome,
      lid: (sistema.lid as string | null) ?? null,
      photo: (sistema.photo as string | null) ?? null,
    }

    if (typeof sistema.created_at === 'string' && sistema.created_at.trim()) {
      linha.created_at = sistema.created_at
    }
    if (sistema.conversa_aberta !== undefined) {
      linha.conversa_aberta = sistema.conversa_aberta as boolean | null
    }
    if (sistema.name_group !== undefined) {
      linha.name_group = (sistema.name_group as string | null) ?? null
    }
    if (sistema.ia_ligada !== undefined) {
      linha.ia_ligada = sistema.ia_ligada as boolean | null
    }
    if (sistema.latitude !== undefined) {
      linha.latitude = sistema.latitude as number | null
    }
    if (sistema.longitude !== undefined) {
      linha.longitude = sistema.longitude as number | null
    }
    if (camposPersonalizados.length) {
      linha.campos_personalizados = camposPersonalizados
    }
    if (colunaIdFunil != null) {
      linha.status_funil = {
        coluna_id: colunaIdFunil,
        ...(atendenteIdFunil ? { atendente_id: atendenteIdFunil } : {}),
      }
    }

    out.push(linha)
    diagnostico.validas += 1
  }

  return { linhas: out, diagnostico }
}

export function mapeamentoTemNome(mapeamentoPorIndice: Record<number, string>): boolean {
  return Object.values(mapeamentoPorIndice).some((v) => v === 'name')
}

export function mapeamentoTemPhone(mapeamentoPorIndice: Record<number, string>): boolean {
  return Object.values(mapeamentoPorIndice).some((v) => v === 'phone')
}

export function mapeamentoTemIdCanal(mapeamentoPorIndice: Record<number, string>): boolean {
  return Object.values(mapeamentoPorIndice).some((v) => v === 'id_canal')
}
