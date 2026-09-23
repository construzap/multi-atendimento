import { createError } from 'h3'
import type { CanalHorarios } from '#shared/types/canal'
import type {
  LojaCanalPublico,
  LojaCardapioPublico,
  LojaProdutoPublico,
  LojaTermoPublico,
  LojaWorkspacePublico,
} from '#shared/types/loja'
import { parseCanalHorarios } from '#shared/utils/validarCanalConfigLoja'

/** Mesmo formato do check `canais_loja_slug_formato_chk`. */
export const LOJA_SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/

export const LOJA_CARDAPIO_CACHE_CONTROL =
  'public, s-maxage=30, stale-while-revalidate=120'

export function parseLojaOffset(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') return 0
  const n = Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

export function parseLojaSlug(raw: unknown): string {
  const slug = String(raw ?? '').trim().toLowerCase()
  if (!slug || !LOJA_SLUG_RE.test(slug)) {
    throw createError({ statusCode: 404, statusMessage: 'Loja não encontrada.' })
  }
  return slug
}

function asPositiveInt(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || n < 1) return null
  return Math.trunc(n)
}

function asInt(raw: unknown, fallback = 0): number {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.trunc(n)
}

function asMoney(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return null
  return n
}

function asText(raw: unknown): string | null {
  if (raw == null) return null
  const s = String(raw).trim()
  return s.length ? s : null
}

function asFiniteNumber(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return null
  return n
}

export function parseLojaCanalRow(raw: unknown): LojaCanalPublico | null {
  if (raw == null || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  const id = asPositiveInt(rec.id)
  const workspaceId = asPositiveInt(rec.workspace_id)
  if (id == null || workspaceId == null) return null

  const horariosParsed = parseCanalHorarios(rec.horarios)
  const horarios: CanalHorarios | null = typeof horariosParsed === 'string' ? null : horariosParsed

  return {
    id,
    workspace_id: workspaceId,
    longitude: asFiniteNumber(rec.longitude),
    latitude: asFiniteNumber(rec.latitude),
    horarios,
    tempo_aviso_minutos: Math.max(asInt(rec.tempo_aviso_minutos, 30), 0),
    endereco: asText(rec.endereco),
    loja_aberta: rec.loja_aberta !== false,
    agenda_pedido: rec.agenda_pedido === true,
    valor_pedido_minimo: Math.max(asMoney(rec.valor_pedido_minimo) ?? 0, 0),
  }
}

function parseWorkspace(raw: unknown): LojaWorkspacePublico | null {
  if (raw == null || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  const id = asPositiveInt(rec.id)
  const nome = asText(rec.nome)
  if (id == null || !nome) return null
  return {
    id,
    nome,
    logo_url: asText(rec.logo_url),
  }
}

function parseTermo(raw: unknown): LojaTermoPublico | null {
  if (raw == null || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  const id = asPositiveInt(rec.id)
  const nome = asText(rec.nome)
  if (id == null || !nome) return null
  return {
    id,
    nome,
    ordem: asInt(rec.ordem, 0),
  }
}

function parseProduto(raw: unknown): LojaProdutoPublico | null {
  if (raw == null || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  const id = asPositiveInt(rec.id)
  const termoId = asPositiveInt(rec.termo_id)
  const nome = asText(rec.nome)
  if (id == null || termoId == null || !nome) return null
  return {
    id,
    termo_id: termoId,
    ordem: asInt(rec.ordem, 0),
    nome,
    descricao: asText(rec.descricao),
    preco: asMoney(rec.preco),
    preco_promocional: asMoney(rec.preco_promocional),
    imagem_url: asText(rec.imagem_url),
  }
}

export function isLojaCardapioRpcAusente(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  const msg = String(err.message ?? '')
  return (
    err.code === 'PGRST202' ||
    err.code === '42883' ||
    /loja_cardapio/i.test(msg)
  )
}

/**
 * Sanitiza o JSON da RPC: só campos públicos, sem passar o payload cru adiante.
 */
export function parseLojaCardapioRpc(
  raw: unknown,
  offset = 0,
  canal: LojaCanalPublico | null = null,
): LojaCardapioPublico | null {
  const obj =
    typeof raw === 'string'
      ? (() => {
          try {
            return JSON.parse(raw) as unknown
          } catch {
            return null
          }
        })()
      : raw

  if (obj == null || typeof obj !== 'object') return null
  const rec = obj as Record<string, unknown>
  const workspace = parseWorkspace(rec.workspace)
  if (!workspace || !canal) return null
  if (workspace.id !== canal.workspace_id) return null

  const termos: LojaTermoPublico[] = []
  if (Array.isArray(rec.termos)) {
    for (const item of rec.termos) {
      const t = parseTermo(item)
      if (t) termos.push(t)
    }
  }

  const produtos: LojaProdutoPublico[] = []
  if (Array.isArray(rec.produtos)) {
    for (const item of rec.produtos) {
      const p = parseProduto(item)
      if (p) produtos.push(p)
    }
  }

  const totalRaw = asInt(rec.total, produtos.length)
  const total = Math.max(totalRaw, produtos.length)

  return {
    workspace,
    canal,
    termos,
    produtos,
    total,
    has_more: rec.has_more === true || total > offset + produtos.length,
  }
}
