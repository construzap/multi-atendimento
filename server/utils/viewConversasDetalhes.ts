import type { TipoCampoPersonalizado } from '#shared/types/camposPersonalizados'
import type {
  Contato,
  ContatoCampoPersonalizadoResumo,
  ContatoStatusFunil,
} from '#shared/types/contato'

const TIPOS_CAMPO = new Set<TipoCampoPersonalizado>(['text', 'number', 'date', 'boolean'])

function parseTipoCampo(raw: unknown): TipoCampoPersonalizado {
  const s = String(raw ?? '').trim().toLowerCase()
  return TIPOS_CAMPO.has(s as TipoCampoPersonalizado) ? (s as TipoCampoPersonalizado) : 'text'
}

export function parseCamposPersonalizadosView(raw: unknown): ContatoCampoPersonalizadoResumo[] {
  if (raw == null) return []

  let lista: unknown = raw
  if (typeof raw === 'string') {
    try {
      lista = JSON.parse(raw)
    } catch {
      return []
    }
  }

  if (!Array.isArray(lista)) return []

  const out: ContatoCampoPersonalizadoResumo[] = []
  for (const item of lista) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'number' ? row.id : Number(row.id)
    if (!Number.isFinite(id) || id < 1) continue
    const nome = String(row.nome ?? '').trim()
    const valorRaw = row.valor
    const valor = valorRaw === null || valorRaw === undefined ? null : String(valorRaw)
    out.push({
      id,
      nome,
      tipo: parseTipoCampo(row.tipo),
      valor,
    })
  }

  out.sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }))
  return out
}

function intOrNull(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null
  const n = typeof raw === 'number' ? Math.trunc(raw) : Number.parseInt(String(raw), 10)
  return Number.isFinite(n) ? n : null
}

function strOrNull(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null
  const s = typeof raw === 'string' ? raw.trim() : String(raw).trim()
  return s.length ? s : null
}

export function parseStatusFunilView(raw: unknown): ContatoStatusFunil | null {
  if (raw == null) return null

  let obj: unknown = raw
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw)
    } catch {
      return null
    }
  }

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null

  const row = obj as Record<string, unknown>
  const colunaId = intOrNull(row.coluna_id)
  if (colunaId == null || colunaId < 1) return null

  return {
    coluna_id: colunaId,
    coluna_nome: strOrNull(row.coluna_nome),
    coluna_cor: strOrNull(row.coluna_cor),
    funil_id: intOrNull(row.funil_id),
    atendente_id: strOrNull(row.atendente_id),
    prioridade: intOrNull(row.prioridade),
    posicao: intOrNull(row.posicao),
  }
}

/** Monta `status_funil` a partir das colunas planas de `view_kanban_conversas`. */
export function statusFunilFromKanbanViewRow(row: Record<string, unknown>): ContatoStatusFunil | null {
  const colunaId = intOrNull(row.coluna_id)
  if (colunaId == null || colunaId < 1) return null

  const atendenteRaw = row.atendente_id
  const atendente_id =
    atendenteRaw === null || atendenteRaw === undefined
      ? null
      : String(atendenteRaw).trim() || null

  return {
    coluna_id: colunaId,
    coluna_nome: strOrNull(row.coluna_nome),
    coluna_cor: strOrNull(row.coluna_cor),
    funil_id: intOrNull(row.funil_id),
    atendente_id,
    prioridade: intOrNull(row.prioridade),
    posicao: intOrNull(row.posicao),
  }
}

/**
 * Mapeia linha de `view_kanban_conversas` (ou legado `view_conversas_com_detalhes_campos`).
 */
export function mapViewRowToContato(row: Record<string, unknown>): Contato {
  const naoLidasRaw = row.nao_lidas
  const naoLidas =
    naoLidasRaw != null && Number.isFinite(Number(naoLidasRaw))
      ? Math.max(0, Math.trunc(Number(naoLidasRaw)))
      : 0

  const key = String(row.conversa_key ?? row.key ?? '').trim()

  return {
    key,
    name: strOrNull(row.name),
    created_at: strOrNull(row.created_at),
    updated_at: strOrNull(row.updated_at),
    id_canal: intOrNull(row.id_canal),
    phone: strOrNull(row.phone),
    lid: strOrNull(row.lid),
    connect_phone: strOrNull(row.connect_phone),
    photo: strOrNull(row.photo),
    workspace_id: intOrNull(row.workspace_id),
    latitude:
      row.latitude != null && Number.isFinite(Number(row.latitude)) ? Number(row.latitude) : null,
    longitude:
      row.longitude != null && Number.isFinite(Number(row.longitude)) ? Number(row.longitude) : null,
    conversa_aberta:
      row.conversa_aberta === true ? true : row.conversa_aberta === false ? false : null,
    is_group: row.is_group === true ? true : row.is_group === false ? false : null,
    name_group: strOrNull(row.name_group),
    ia_ligada: row.ia_ligada === true ? true : row.ia_ligada === false ? false : null,
    nao_lidas: naoLidas,
    campos_personalizados: parseCamposPersonalizadosView(row.campos_personalizados),
    status_funil: parseStatusFunilView(row.status_funil) ?? statusFunilFromKanbanViewRow(row),
  }
}

/** Mantém a 1.ª ocorrência por `key` (a view pode repetir `key` por status de funil). */
export function deduplicarContatosPorKey(rows: Contato[]): Contato[] {
  const seen = new Set<string>()
  const out: Contato[] = []
  for (const row of rows) {
    const key = row.key?.trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}
