import type {
  CanalConfigFollowUp,
  CanalFormasPagamento,
  CanalFormasPagamentoEntrega,
  CanalFormasPagamentoOnline,
} from '#shared/types/canal'
import { CANAL_FORMAS_PAGAMENTO_PADRAO } from '#shared/types/canal'

const LOJA_SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/

function objetoJson(raw: unknown): Record<string, unknown> | null {
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
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  return null
}

function boolCampo(raw: unknown, fallback: boolean): boolean {
  if (typeof raw === 'boolean') return raw
  if (raw === 'true') return true
  if (raw === 'false') return false
  return fallback
}

function lerGrupoOnline(raw: unknown, padrao: CanalFormasPagamentoOnline): CanalFormasPagamentoOnline {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  return {
    pix: boolCampo(o.pix, padrao.pix),
    boleto: boolCampo(o.boleto, padrao.boleto),
    cartao_debito: boolCampo(o.cartao_debito, padrao.cartao_debito),
    cartao_credito: boolCampo(o.cartao_credito, padrao.cartao_credito),
  }
}

function lerGrupoEntrega(
  raw: unknown,
  padrao: CanalFormasPagamentoEntrega,
): CanalFormasPagamentoEntrega {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  return {
    dinheiro: boolCampo(o.dinheiro, padrao.dinheiro),
    cartao_debito: boolCampo(o.cartao_debito, padrao.cartao_debito),
    vale_refeicao: boolCampo(o.vale_refeicao, padrao.vale_refeicao),
    cartao_credito: boolCampo(o.cartao_credito, padrao.cartao_credito),
  }
}

/** Leitura tolerante (GET). Valor ausente/inválido cai no padrão do banco. */
export function normalizarFormasPagamento(raw: unknown): CanalFormasPagamento {
  const obj = objetoJson(raw)
  if (!obj) return JSON.parse(JSON.stringify(CANAL_FORMAS_PAGAMENTO_PADRAO)) as CanalFormasPagamento
  return {
    online: lerGrupoOnline(obj.online, CANAL_FORMAS_PAGAMENTO_PADRAO.online),
    entrega: lerGrupoEntrega(obj.entrega, CANAL_FORMAS_PAGAMENTO_PADRAO.entrega),
  }
}

export function parseFormasPagamento(raw: unknown): CanalFormasPagamento | string {
  if (raw == null) return JSON.parse(JSON.stringify(CANAL_FORMAS_PAGAMENTO_PADRAO)) as CanalFormasPagamento
  const obj = objetoJson(raw)
  if (!obj) return 'formas_pagamento inválido.'
  return {
    online: lerGrupoOnline(obj.online, CANAL_FORMAS_PAGAMENTO_PADRAO.online),
    entrega: lerGrupoEntrega(obj.entrega, CANAL_FORMAS_PAGAMENTO_PADRAO.entrega),
  }
}

/** Leitura tolerante (GET). */
export function normalizarConfigFollowUp(raw: unknown): CanalConfigFollowUp {
  const obj = objetoJson(raw)
  if (!obj) return {}
  const out: CanalConfigFollowUp = {}
  for (const [k, v] of Object.entries(obj)) {
    if (!/^\d+$/.test(k)) continue
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue
    const minutos = (v as Record<string, unknown>).minutos_espera
    const n = typeof minutos === 'number' ? minutos : Number.parseInt(String(minutos ?? ''), 10)
    if (!Number.isFinite(n) || n < 1) continue
    out[String(Number.parseInt(k, 10))] = { minutos_espera: Math.trunc(n) }
  }
  return out
}

export function parseConfigFollowUp(raw: unknown): CanalConfigFollowUp | string {
  if (raw == null) return {}
  if (typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw as object).length === 0) {
    return {}
  }
  const obj = objetoJson(raw)
  if (!obj) return 'config_follow_up inválido.'
  const out: CanalConfigFollowUp = {}
  for (const [k, v] of Object.entries(obj)) {
    if (!/^\d+$/.test(k) || Number.parseInt(k, 10) < 1) {
      return `Passo de follow-up inválido: "${k}". Use 1, 2, 3…`
    }
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      return `Follow-up ${k} sem minutos_espera.`
    }
    const minutos = (v as Record<string, unknown>).minutos_espera
    const n = typeof minutos === 'number' ? minutos : Number.parseInt(String(minutos ?? ''), 10)
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
      return `Minutos de espera inválidos no follow-up ${k} (informe um inteiro >= 1).`
    }
    out[String(Number.parseInt(k, 10))] = { minutos_espera: n }
  }
  return out
}

/**
 * Slug da loja. Vazio → null.
 * Erro de formato volta como string começando por "Slug".
 */
export function parseLojaSlug(raw: unknown): string | null | { erro: string } {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'string') return { erro: 'Slug da loja inválido.' }
  const slug = raw.trim().toLowerCase()
  if (!slug) return null
  if (!LOJA_SLUG_RE.test(slug)) {
    return {
      erro: 'Slug da loja inválido. Use letras minúsculas, números e hífen (sem hífen no início ou no fim).',
    }
  }
  return slug
}

export function parseMensagemSaudacao(raw: unknown): string | null | { erro: string } {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'string') return { erro: 'Mensagem de saudação inválida.' }
  const t = raw.trim()
  return t || null
}

/** URL pública da imagem de saudação. Vazio → null. */
export function parseImagemSaudacao(raw: unknown): string | null | { erro: string } {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'string') return { erro: 'Imagem de saudação inválida.' }
  const t = raw.trim()
  if (!t) return null
  if (t.length > 2000) return { erro: 'URL da imagem de saudação é longa demais.' }
  return t
}

export function parseFlagCanal(raw: unknown, label: string): boolean | string {
  if (typeof raw === 'boolean') return raw
  return `${label} inválido.`
}
