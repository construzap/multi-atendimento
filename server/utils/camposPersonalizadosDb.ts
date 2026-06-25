import { createError } from 'h3'
import type { CampoPersonalizado, TipoCampoPersonalizado, ValorCampoPersonalizado } from '#shared/types/camposPersonalizados'

const TIPOS_VALIDOS = new Set<TipoCampoPersonalizado>(['text', 'number', 'date', 'boolean'])

function normalizarTipoCampo(raw: unknown): TipoCampoPersonalizado | null {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!s) return null
  return TIPOS_VALIDOS.has(s as TipoCampoPersonalizado) ? (s as TipoCampoPersonalizado) : null
}

/** Validação estrita — usar em POST/PATCH. */
export function parseTipoCampo(raw: unknown): TipoCampoPersonalizado {
  const tipo = normalizarTipoCampo(raw ?? 'text')
  if (!tipo) {
    throw createError({
      statusCode: 400,
      statusMessage: 'tipo inválido (use: text, number, date ou boolean).',
    })
  }
  return tipo
}

/** Leitura do banco — nunca quebra a listagem por tipo legado ou inválido. */
export function tipoCampoFromRow(raw: unknown): TipoCampoPersonalizado {
  return normalizarTipoCampo(raw) ?? 'text'
}

export function mapCampoRow(r: Record<string, unknown>): CampoPersonalizado {
  const id = typeof r.id === 'number' ? r.id : Number(r.id)
  const workspace_id = typeof r.workspace_id === 'number' ? r.workspace_id : Number(r.workspace_id)
  const nome = String(r.nome ?? '').trim()
  const tipo = tipoCampoFromRow(r.tipo)
  return {
    id: Number.isFinite(id) ? id : 0,
    workspace_id: Number.isFinite(workspace_id) ? workspace_id : 0,
    nome,
    tipo,
    created_at: String(r.created_at ?? ''),
  }
}

export function mapValorRow(r: Record<string, unknown>): ValorCampoPersonalizado {
  const id = typeof r.id === 'number' ? r.id : Number(r.id)
  const campo_id = typeof r.campo_id === 'number' ? r.campo_id : Number(r.campo_id)
  const valorRaw = r.valor
  const valor =
    valorRaw === null || valorRaw === undefined ? null : String(valorRaw)
  return {
    id: Number.isFinite(id) ? id : 0,
    campo_id: Number.isFinite(campo_id) ? campo_id : 0,
    conversa_key: String(r.conversa_key ?? ''),
    valor,
    updated_at: String(r.updated_at ?? ''),
  }
}

/** Converte o valor recebido da API para texto antes de gravar no banco. */
export function serializarValorCampo(tipo: TipoCampoPersonalizado, raw: unknown): string | null {
  if (raw === null || raw === undefined) return null

  if (tipo === 'text') {
    const s = String(raw).trim()
    return s.length ? s : null
  }

  if (tipo === 'number') {
    const n =
      typeof raw === 'number'
        ? raw
        : Number.parseFloat(String(raw).trim().replace(/\./g, '').replace(',', '.'))
    if (!Number.isFinite(n)) {
      throw createError({ statusCode: 400, statusMessage: 'Valor numérico inválido.' })
    }
    return String(n)
  }

  if (tipo === 'date') {
    const s = String(raw).trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      throw createError({ statusCode: 400, statusMessage: 'Data inválida (use AAAA-MM-DD).' })
    }
    const d = new Date(`${s}T00:00:00.000Z`)
    if (Number.isNaN(d.getTime())) {
      throw createError({ statusCode: 400, statusMessage: 'Data inválida.' })
    }
    return s
  }

  if (tipo === 'boolean') {
    if (typeof raw === 'boolean') return raw ? 'true' : 'false'
    const s = String(raw).trim().toLowerCase()
    if (['true', '1', 'sim', 's', 'yes', 'y'].includes(s)) return 'true'
    if (['false', '0', 'nao', 'não', 'n', 'no'].includes(s)) return 'false'
    throw createError({ statusCode: 400, statusMessage: 'Valor booleano inválido.' })
  }

  return null
}