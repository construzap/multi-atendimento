import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type {
  KanbanBoardResponse,
  KanbanCard,
  KanbanColumn,
  KanbanColumnPageResponse,
} from '#shared/types/kanban'
import { getAuthUserId } from '../../utils/getAuthUserId'
import { checkWorkspace } from '../../utils/checkWorkspace'
import type { KanbanCampoPersonalizadoResumo } from '#shared/types/kanban'
import type { TipoCampoPersonalizado } from '#shared/types/camposPersonalizados'

const CARDS_PER_PAGE = 10

const VIEW_RESOURCE = 'view_conversas_com_detalhes_campos'

const VIEW_SELECT =
  'key, name, phone, photo, message, updated_at, id_canal, is_group, lid, nao_lidas, campos_personalizados, workspace_id, deleted_at'

function parseSearchQuery(raw: unknown): string {
  if (raw === undefined || raw === null) return ''
  const s = String(raw).trim()
  return s.length > 100 ? s.slice(0, 100) : s
}

type ConvEmbed = {
  key?: string | null
  name: string | null
  phone: string | null
  photo: string | null
  message: string | null
  updated_at: string | null
  id_canal: number | null
  is_group: boolean | null
  lid: string | null
  nao_lidas: number | null
  campos_personalizados: unknown
}

type StatusRow = {
  conversa_key: string
  coluna_id: number
  prioridade: number | null
  /** Dados da view `view_conversas_com_detalhes_campos` (join por `conversa_key` = `key`). */
  view_conversas_com_detalhes_campos: ConvEmbed | ConvEmbed[] | null
}

type SupabaseAdmin = ReturnType<typeof serverSupabaseServiceRole<any>>

function parsePositiveInt(raw: unknown, fallback: number): number {
  if (raw === undefined || raw === null || raw === '') return fallback
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw createError({ statusCode: 400, statusMessage: 'offset inválido.' })
  }
  return n
}

function parseColunaId(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'coluna_id inválido.' })
  }
  return n
}

function unwrapConversa(raw: ConvEmbed | ConvEmbed[] | null): ConvEmbed | null {
  if (!raw) return null
  return Array.isArray(raw) ? raw[0] ?? null : raw
}

const TIPOS_CAMPO = new Set<TipoCampoPersonalizado>(['text', 'number', 'date', 'boolean'])

function parseTipoCampo(raw: unknown): TipoCampoPersonalizado {
  const s = String(raw ?? '').trim().toLowerCase()
  return TIPOS_CAMPO.has(s as TipoCampoPersonalizado) ? (s as TipoCampoPersonalizado) : 'text'
}

function parseCamposPersonalizados(raw: unknown): KanbanCampoPersonalizadoResumo[] {
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

  const out: KanbanCampoPersonalizadoResumo[] = []
  for (const item of lista) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'number' ? row.id : Number(row.id)
    if (!Number.isFinite(id) || id < 1) continue
    const nome = String(row.nome ?? '').trim()
    const valorRaw = row.valor
    const valor =
      valorRaw === null || valorRaw === undefined ? null : String(valorRaw)
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

function parseIsGroup(raw: unknown): boolean | null {
  if (raw === true) return true
  if (raw === false) return false
  return null
}

function rowToCard(row: StatusRow, nomePorCanalId: Map<number, string>): KanbanCard {
  const conv = unwrapConversa(row.view_conversas_com_detalhes_campos)
  const rawCanalId =
    conv && typeof conv === 'object' && 'id_canal' in conv
      ? (conv as { id_canal: unknown }).id_canal
      : null
  const idCanal =
    rawCanalId != null && Number.isFinite(Number(rawCanalId))
      ? Number(rawCanalId)
      : null
  const canalNome =
    idCanal != null && nomePorCanalId.has(idCanal)
      ? nomePorCanalId.get(idCanal) ?? null
      : null

  return {
    conversa_key: row.conversa_key,
    coluna_id: row.coluna_id,
    prioridade:
      row.prioridade != null && Number.isFinite(Number(row.prioridade))
        ? Number(row.prioridade)
        : null,
    name: conv && typeof conv === 'object' && 'name' in conv ? (conv as { name: string | null }).name : null,
    phone: conv && typeof conv === 'object' && 'phone' in conv ? (conv as { phone: string | null }).phone : null,
    photo: conv && typeof conv === 'object' && 'photo' in conv ? (conv as { photo: string | null }).photo : null,
    lid: conv && typeof conv === 'object' && 'lid' in conv ? (conv as { lid: string | null }).lid : null,
    preview: conv && typeof conv === 'object' && 'message' in conv ? (conv as { message: string | null }).message : null,
    updated_at: conv && typeof conv === 'object' && 'updated_at' in conv ? (conv as { updated_at: string | null }).updated_at : null,
    canal_nome: canalNome,
    id_canal: idCanal,
    is_group:
      conv && typeof conv === 'object' && 'is_group' in conv
        ? parseIsGroup((conv as { is_group: unknown }).is_group)
        : null,
    nao_lidas: (() => {
      const raw =
        conv && typeof conv === 'object' && 'nao_lidas' in conv
          ? (conv as { nao_lidas: unknown }).nao_lidas
          : null
      const n = raw != null && Number.isFinite(Number(raw)) ? Number(raw) : 0
      return Math.max(0, Math.trunc(n))
    })(),
    campos_personalizados:
      conv && typeof conv === 'object' && 'campos_personalizados' in conv
        ? parseCamposPersonalizados((conv as { campos_personalizados: unknown }).campos_personalizados)
        : [],
  }
}

function collectCanalIds(rows: StatusRow[]): Set<number> {
  const canalIds = new Set<number>()
  for (const row of rows) {
    const conv = unwrapConversa(row.view_conversas_com_detalhes_campos)
    const rawId =
      conv && typeof conv === 'object' && 'id_canal' in conv
        ? (conv as { id_canal: unknown }).id_canal
        : null
    const id =
      rawId != null && Number.isFinite(Number(rawId))
        ? Number(rawId)
        : null
    if (id != null && id >= 1) {
      canalIds.add(id)
    }
  }
  return canalIds
}

async function fetchNomePorCanalId(
  admin: SupabaseAdmin,
  workspaceId: number,
  canalIds: Set<number>,
): Promise<Map<number, string>> {
  const nomePorCanalId = new Map<number, string>()
  if (canalIds.size === 0) return nomePorCanalId

  const { data: canaisRows, error: canaisErr } = await admin
    .from('canais')
    .select('id, nome')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .in('id', [...canalIds])

  if (canaisErr) {
    throw createError({ statusCode: 500, statusMessage: canaisErr.message })
  }

  for (const r of (canaisRows ?? []) as Array<{ id: unknown; nome: unknown }>) {
    const id = typeof r.id === 'number' ? r.id : Number(r.id)
    if (!Number.isFinite(id)) continue
    const nome =
      typeof r.nome === 'string' && r.nome.trim()
        ? r.nome.trim()
        : null
    if (nome) {
      nomePorCanalId.set(id, nome)
    }
  }

  return nomePorCanalId
}

async function fetchViewPorKeys(
  admin: SupabaseAdmin,
  workspaceId: number,
  keys: string[],
): Promise<Map<string, ConvEmbed>> {
  const map = new Map<string, ConvEmbed>()
  if (keys.length === 0) return map

  const { data, error } = await admin
    .from(VIEW_RESOURCE)
    .select(VIEW_SELECT)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .in('key', keys)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  for (const row of (data ?? []) as ConvEmbed[]) {
    const key = String(row.key ?? '').trim()
    if (key) map.set(key, row)
  }

  return map
}

async function fetchCardsForColumn(
  admin: SupabaseAdmin,
  workspaceId: number,
  colunaId: number,
  offset: number,
  limit: number,
  searchRaw: string = '',
): Promise<{ rows: StatusRow[]; total: number }> {
  const hasSearch = searchRaw.length > 0
  const search = searchRaw.toLowerCase()

  const { data: statusRows, error: statusErr } = await admin
    .from('funil_conversa_status')
    .select('conversa_key, coluna_id, prioridade')
    .eq('workspace_id', workspaceId)
    .eq('coluna_id', colunaId)

  if (statusErr) {
    throw createError({ statusCode: 500, statusMessage: statusErr.message })
  }

  const statuses = (statusRows ?? []) as Array<{
    conversa_key: string
    coluna_id: number
    prioridade: number | null
  }>

  const keys = statuses.map((s) => s.conversa_key)
  const viewMap = await fetchViewPorKeys(admin, workspaceId, keys)

  let rows: StatusRow[] = statuses
    .map((status) => ({
      conversa_key: status.conversa_key,
      coluna_id: status.coluna_id,
      prioridade: status.prioridade,
      view_conversas_com_detalhes_campos: viewMap.get(status.conversa_key) ?? null,
    }))
    .filter((row) => unwrapConversa(row.view_conversas_com_detalhes_campos) != null)

  if (hasSearch) {
    rows = rows.filter((row) => {
      const view = unwrapConversa(row.view_conversas_com_detalhes_campos)
      if (!view) return false
      const name = String(view.name ?? '').toLowerCase()
      const phone = String(view.phone ?? '').toLowerCase()
      return name.includes(search) || phone.includes(search)
    })
  }

  rows.sort((a, b) => {
    const ta = unwrapConversa(a.view_conversas_com_detalhes_campos)?.updated_at ?? ''
    const tb = unwrapConversa(b.view_conversas_com_detalhes_campos)?.updated_at ?? ''
    if (ta !== tb) return tb.localeCompare(ta)
    return a.conversa_key.localeCompare(b.conversa_key)
  })

  const total = rows.length
  return {
    rows: rows.slice(offset, offset + limit),
    total,
  }
}

async function buildCardsPage(
  admin: SupabaseAdmin,
  workspaceId: number,
  colunaId: number,
  offset: number,
  limit: number,
  searchRaw: string = '',
): Promise<{ cards: KanbanCard[]; total_cards: number; has_more: boolean }> {
  const { rows, total } = await fetchCardsForColumn(
    admin,
    workspaceId,
    colunaId,
    offset,
    limit,
    searchRaw,
  )
  const nomePorCanalId = await fetchNomePorCanalId(admin, workspaceId, collectCanalIds(rows))
  const cards = rows.map((row) => rowToCard(row, nomePorCanalId))
  return {
    cards,
    total_cards: total,
    has_more: offset + cards.length < total,
  }
}

/**
 * GET /api/kanban?workspace_id=&q=
 *
 * Board completo; `q` filtra cards por nome ou telefone da conversa (ilike).
 *
 * GET /api/kanban?workspace_id=&coluna_id=&offset=&q=
 *
 * Paginação por coluna: retorna apenas os próximos cards da coluna informada.
 */
export default defineEventHandler(async (event): Promise<KanbanBoardResponse | KanbanColumnPageResponse> => {
  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const q = getQuery(event)
  const rawWs = q.workspace_id
  if (rawWs === undefined || rawWs === null || rawWs === '') {
    throw createError({ statusCode: 400, statusMessage: 'Informe workspace_id na query.' })
  }

  const workspaceId =
    typeof rawWs === 'number' ? rawWs : Number.parseInt(String(rawWs), 10)
  if (!Number.isFinite(workspaceId) || !Number.isInteger(workspaceId) || workspaceId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }

  await checkWorkspace(event, workspaceId, userId)

  const colunaIdFilter = parseColunaId(q.coluna_id)
  const offset = parsePositiveInt(q.offset, 0)
  const searchRaw = parseSearchQuery(q.q ?? q.busca)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: funil, error: funilErr } = await admin
    .from('funil_workspace')
    .select('id, nome')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (funilErr) {
    throw createError({ statusCode: 500, statusMessage: funilErr.message })
  }

  if (!funil) {
    if (colunaIdFilter != null) {
      throw createError({ statusCode: 404, statusMessage: 'Funil não encontrado.' })
    }
    return {
      funil_id: 0,
      funil_nome: '',
      columns: [],
    }
  }

  const funilId = typeof funil.id === 'number' ? funil.id : Number(funil.id)
  const funilNome = typeof funil.nome === 'string' ? funil.nome : ''

  const { data: colunasRows, error: colErr } = await admin
    .from('funil_workspace_colunas')
    .select('id, nome, cor, ordem')
    .eq('funil_id', funilId)
    .is('deleted_at', null)
    .order('ordem', { ascending: true })

  if (colErr) {
    throw createError({ statusCode: 500, statusMessage: colErr.message })
  }

  const colunas = (colunasRows ?? []) as Array<{
    id: number
    nome: string
    cor: string | null
    ordem: number
  }>

  if (colunaIdFilter != null) {
    const colunaExiste = colunas.some((c) => c.id === colunaIdFilter)
    if (!colunaExiste) {
      throw createError({ statusCode: 404, statusMessage: 'Coluna não encontrada neste funil.' })
    }

    const page = await buildCardsPage(
      admin,
      workspaceId,
      colunaIdFilter,
      offset,
      CARDS_PER_PAGE,
      searchRaw,
    )
    return {
      coluna_id: colunaIdFilter,
      ...page,
    }
  }

  const pages = await Promise.all(
    colunas.map((c) =>
      buildCardsPage(admin, workspaceId, c.id, 0, CARDS_PER_PAGE, searchRaw),
    ),
  )

  const columns: KanbanColumn[] = colunas.map((c, i) => {
    const page = pages[i]!
    return {
      id: c.id,
      nome: c.nome,
      cor: c.cor,
      ordem: c.ordem,
      cards: page.cards,
      total_cards: page.total_cards,
      has_more: page.has_more,
    }
  })

  return {
    funil_id: funilId,
    funil_nome: funilNome,
    columns,
  }
})
