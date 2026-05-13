import { createError } from 'h3'
import type { FreteBairroWorkspace } from '#shared/types/frete'

export function parseWorkspaceId(raw: unknown): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }
  return n
}

export function parsePositiveRowId(raw: unknown, label = 'id'): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  return n
}

export function parseFreteGratis(raw: unknown): boolean {
  if (raw === undefined || raw === null) return false
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'number') return raw !== 0
  const s = String(raw).trim().toLowerCase()
  return ['1', 'true', 'on', 'yes', 'sim', 's'].includes(s)
}

/** Valor monetário pt-BR. Retorna número ou `null` se string vazia (só quando `permiteVazio`). */
export function parseValorFreteBr(raw: unknown, permiteVazio: boolean): number | null {
  if (raw === undefined || raw === null) {
    if (permiteVazio) return null
    throw createError({ statusCode: 400, statusMessage: 'Informe o valor do frete ou marque frete grátis.' })
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw < 0) throw createError({ statusCode: 400, statusMessage: 'Valor do frete não pode ser negativo.' })
    return Math.round(raw * 100) / 100
  }
  let s = String(raw).trim().replace(/\s+/g, '')
  if (!s.length) {
    if (permiteVazio) return null
    throw createError({ statusCode: 400, statusMessage: 'Informe o valor do frete ou marque frete grátis.' })
  }

  let n: number
  if (s.includes(',')) {
    const parts = s.split(',')
    const intPart = parts[0] ?? ''
    const frac = (parts[1] ?? '').replace(/\D/g, '').slice(0, 2)
    const intNorm = intPart.replace(/\./g, '')
    n = Number.parseFloat(`${intNorm}.${frac.length ? frac : '0'}`)
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    n = Number.parseFloat(s.replace(/\./g, ''))
  } else {
    n = Number.parseFloat(s.replace(',', '.'))
  }

  if (!Number.isFinite(n) || n < 0) {
    throw createError({ statusCode: 400, statusMessage: 'Valor do frete inválido.' })
  }
  if (n > 99_999_999.99) {
    throw createError({ statusCode: 400, statusMessage: 'Valor do frete acima do limite permitido.' })
  }
  return Math.round(n * 100) / 100
}

export function mapBairroWorkspaceRow(r: Record<string, unknown>): FreteBairroWorkspace {
  const id = typeof r.id === 'number' ? r.id : Number(r.id)
  const workspace_id = typeof r.workspace_id === 'number' ? r.workspace_id : Number(r.workspace_id)
  const valorRaw = r.valor_frete
  let valor_frete: number | null = null
  if (valorRaw !== undefined && valorRaw !== null && valorRaw !== '') {
    const v = typeof valorRaw === 'number' ? valorRaw : Number.parseFloat(String(valorRaw))
    valor_frete = Number.isFinite(v) ? Math.round(v * 100) / 100 : null
  }
  return {
    id: Number.isFinite(id) ? id : 0,
    workspace_id: Number.isFinite(workspace_id) ? workspace_id : 0,
    bairro: String(r.bairro ?? '').trim(),
    valor_frete,
    frete_gratis: Boolean(r.frete_gratis),
    ativo: Boolean(r.ativo ?? true),
    created_at: String(r.created_at ?? ''),
  }
}
