import { createError } from 'h3'
import type {
  CanalPagamentoInfo,
  CanalProvedorPagamentos,
  CanalTaxasCartao,
} from '#shared/types/canal'

export function parseProvedorPagamentos(raw: unknown): CanalProvedorPagamentos | null {
  if (raw === 'pagar.me' || raw === 'asaas') return raw
  return null
}

/** Converte valor de taxa (número ou string com vírgula) para número. */
export function parseTaxaValor(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s) return null
    const n = Number.parseFloat(s.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function taxasCartaoRawParaObjeto(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s) return null
    try {
      const parsed = JSON.parse(s) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return null
    }
    return null
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  return null
}

type ParseTaxasCartaoOpts = {
  /** Ignora parcelas com taxa 0 (padding legado no banco). */
  omitZero?: boolean
}

/** Lê taxas do banco — só chaves presentes, sem preencher parcelas padrão. */
export function parseTaxasCartao(raw: unknown, opts: ParseTaxasCartaoOpts = {}): CanalTaxasCartao {
  const omitZero = opts.omitZero !== false
  const obj = taxasCartaoRawParaObjeto(raw)
  if (!obj) return {}

  const out: CanalTaxasCartao = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = k.trim().toLowerCase()
    if (!/^\d+x$/.test(key)) continue
    const n = parseTaxaValor(v)
    if (n === null) continue
    if (omitZero && n === 0) continue
    out[key] = n
  }
  return out
}

/**
 * Normaliza taxas enviadas no POST — apenas parcelas preenchidas (> 0),
 * vírgula → ponto. Vazio / null / só zeros → null no banco.
 */
export function parseTaxasCartaoParaSalvar(raw: unknown): CanalTaxasCartao | null {
  if (raw === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'taxas_cartao é obrigatório.' })
  }
  if (raw === null) return null

  const obj = taxasCartaoRawParaObjeto(raw)
  if (!obj) {
    // `{}` vazio ou string vazia → limpar taxas
    if (
      (typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw as object).length === 0) ||
      (typeof raw === 'string' && !raw.trim())
    ) {
      return null
    }
    throw createError({ statusCode: 400, statusMessage: 'taxas_cartao inválido.' })
  }

  const out: CanalTaxasCartao = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = k.trim().toLowerCase()
    if (!/^\d+x$/.test(key)) continue
    const n = parseTaxaValor(v)
    if (n === null || n === 0) continue
    out[key] = n
  }

  return Object.keys(out).length > 0 ? out : null
}

export function mapCanalPagamentoRow(
  row: Record<string, unknown>,
  canalId: number,
  workspaceId: number,
): CanalPagamentoInfo {
  const cred = row.credenciais_encrypted
  const temCred = cred != null && String(cred).trim().length > 0

  return {
    canal_id: canalId,
    workspace_id: workspaceId,
    provedor_pagamentos: parseProvedorPagamentos(row.provedor_pagamentos),
    chave_pix: typeof row.chave_pix === 'string' ? row.chave_pix : null,
    tem_credenciais_pagarme: temCred,
    taxas_cartao: (() => {
      const taxas = parseTaxasCartao(row.taxas_cartao)
      return Object.keys(taxas).length > 0 ? taxas : null
    })(),
  }
}
