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
import { parseCamposPersonalizadosView } from '../../utils/viewConversasDetalhes'

const CARDS_PER_PAGE = 10

const VIEW_RESOURCE = 'view_kanban_conversas'

const VIEW_SELECT =
  'conversa_key, name, phone, photo, lid, preview, updated_at, id_canal, canal_nome, is_group, name_group, conversa_aberta, ia_ligada, nao_lidas, workspace_id, funil_id, coluna_id, atendente_id, prioridade, campos_personalizados'

type SupabaseAdmin = ReturnType<typeof serverSupabaseServiceRole<any>>

function parseSearchQuery(raw: unknown): string {
  if (raw === undefined || raw === null) return ''
  const s = String(raw).trim()
  return s.length > 100 ? s.slice(0, 100) : s
}

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

function parseFunilIdFilter(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'funil_id inválido.' })
  }
  return n
}

/** `id_canal` ou alias `canal_id`. Omitido / vazio = todos os canais. */
function parseIdCanalFilter(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'id_canal inválido.' })
  }
  return n
}

/** Escapa `%` e `_` para uso em padrões `ilike` do PostgREST. */
function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function quotePostgrestFilterValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function parseBoolOrNull(raw: unknown): boolean | null {
  if (raw === true) return true
  if (raw === false) return false
  return null
}

function intOrNull(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null
  const n = typeof raw === 'number' ? Math.trunc(raw) : Number.parseInt(String(raw), 10)
  return Number.isFinite(n) && n >= 1 ? n : null
}

function viewRowToCard(row: Record<string, unknown>): KanbanCard | null {
  const key = String(row.conversa_key ?? '').trim()
  if (!key) return null

  const colunaId = intOrNull(row.coluna_id)
  if (colunaId == null) return null

  const idCanal = intOrNull(row.id_canal)

  const canalNomeRaw = row.canal_nome
  const canalNome =
    typeof canalNomeRaw === 'string' && canalNomeRaw.trim() ? canalNomeRaw.trim() : null

  const naoLidasRaw = row.nao_lidas
  const naoLidas =
    naoLidasRaw != null && Number.isFinite(Number(naoLidasRaw))
      ? Math.max(0, Math.trunc(Number(naoLidasRaw)))
      : 0

  const prioridadeRaw = row.prioridade
  const prioridade =
    prioridadeRaw != null && Number.isFinite(Number(prioridadeRaw))
      ? Math.trunc(Number(prioridadeRaw))
      : null

  return {
    conversa_key: key,
    coluna_id: colunaId,
    prioridade,
    name: row.name != null ? String(row.name) : null,
    phone: row.phone != null ? String(row.phone) : null,
    photo: row.photo != null ? String(row.photo) : null,
    lid: row.lid != null ? String(row.lid) : null,
    preview: row.preview != null ? String(row.preview) : null,
    updated_at: row.updated_at != null ? String(row.updated_at) : null,
    canal_nome: canalNome,
    id_canal: idCanal,
    is_group: parseBoolOrNull(row.is_group),
    name_group: row.name_group != null ? String(row.name_group) : null,
    conversa_aberta: parseBoolOrNull(row.conversa_aberta),
    ia_ligada: parseBoolOrNull(row.ia_ligada),
    nao_lidas: naoLidas,
    campos_personalizados: parseCamposPersonalizadosView(row.campos_personalizados),
  }
}

function parseIsGroupFilter(raw: unknown): boolean | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined
  const s = String(raw).trim().toLowerCase()
  if (s === 'false' || s === '0') return false
  if (s === 'true' || s === '1') return true
  throw createError({
    statusCode: 400,
    statusMessage: 'is_group inválido (use true ou false).',
  })
}

function aplicarFiltroIsGroup<T extends { or: (filters: string) => T; eq: (col: string, val: boolean) => T }>(
  query: T,
  isGroupFilter: boolean | undefined,
): T {
  if (isGroupFilter === false) {
    return query.or('is_group.is.null,is_group.eq.false')
  }
  if (isGroupFilter === true) {
    return query.eq('is_group', true)
  }
  return query
}

function deduplicarViewRowsPorKey(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Set<string>()
  const out: Record<string, unknown>[] = []
  for (const row of rows) {
    const key = String(row.conversa_key ?? '').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}

function aplicarFiltrosColunaView(
  admin: SupabaseAdmin,
  workspaceId: number,
  colunaId: number,
  funilId: number,
  searchRaw: string,
  isGroupFilter: boolean | undefined,
  idCanalFilter: number | undefined,
) {
  let query = admin
    .from(VIEW_RESOURCE)
    .select(VIEW_SELECT)
    .eq('workspace_id', workspaceId)
    .eq('coluna_id', colunaId)
    .eq('funil_id', funilId)
    .not('coluna_id', 'is', null)

  if (idCanalFilter != null) {
    query = query.eq('id_canal', idCanalFilter)
  }

  query = aplicarFiltroIsGroup(query, isGroupFilter)

  if (searchRaw.length > 0) {
    const esc = escapeIlike(searchRaw)
    const p = quotePostgrestFilterValue(`%${esc}%`)
    query = query.or(`name.ilike.${p},phone.ilike.${p}`)
  }

  return query
}

async function contarCardsColuna(
  admin: SupabaseAdmin,
  workspaceId: number,
  colunaId: number,
  funilId: number,
  searchRaw: string,
  isGroupFilter: boolean | undefined,
  idCanalFilter: number | undefined,
): Promise<number> {
  let query = admin
    .from(VIEW_RESOURCE)
    .select('conversa_key', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('coluna_id', colunaId)
    .eq('funil_id', funilId)
    .not('coluna_id', 'is', null)

  if (idCanalFilter != null) {
    query = query.eq('id_canal', idCanalFilter)
  }

  query = aplicarFiltroIsGroup(query, isGroupFilter)

  if (searchRaw.length > 0) {
    const esc = escapeIlike(searchRaw)
    const p = quotePostgrestFilterValue(`%${esc}%`)
    query = query.or(`name.ilike.${p},phone.ilike.${p}`)
  }

  const { count, error } = await query
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  return count ?? 0
}

async function fetchCardsForColumn(
  admin: SupabaseAdmin,
  workspaceId: number,
  funilId: number,
  colunaId: number,
  offset: number,
  limit: number,
  searchRaw: string = '',
  isGroupFilter: boolean | undefined = undefined,
  idCanalFilter: number | undefined = undefined,
): Promise<{ rows: Record<string, unknown>[]; total: number }> {
  const [listResult, total] = await Promise.all([
    aplicarFiltrosColunaView(
      admin,
      workspaceId,
      colunaId,
      funilId,
      searchRaw,
      isGroupFilter,
      idCanalFilter,
    )
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('conversa_key', { ascending: true })
      .range(offset, offset + limit - 1),
    contarCardsColuna(
      admin,
      workspaceId,
      colunaId,
      funilId,
      searchRaw,
      isGroupFilter,
      idCanalFilter,
    ),
  ])

  if (listResult.error) {
    throw createError({ statusCode: 500, statusMessage: listResult.error.message })
  }

  const rows = deduplicarViewRowsPorKey((listResult.data ?? []) as Record<string, unknown>[])

  return { rows, total }
}

async function buildCardsPage(
  admin: SupabaseAdmin,
  workspaceId: number,
  funilId: number,
  colunaId: number,
  offset: number,
  limit: number,
  searchRaw: string = '',
  isGroupFilter: boolean | undefined = undefined,
  idCanalFilter: number | undefined = undefined,
): Promise<{ cards: KanbanCard[]; total_cards: number; has_more: boolean }> {
  const { rows, total } = await fetchCardsForColumn(
    admin,
    workspaceId,
    funilId,
    colunaId,
    offset,
    limit,
    searchRaw,
    isGroupFilter,
    idCanalFilter,
  )
  const cards = rows
    .map((row) => viewRowToCard(row))
    .filter((card): card is KanbanCard => card != null)

  return {
    cards,
    total_cards: total,
    has_more: offset + cards.length < total,
  }
}

/**
 * GET /api/kanban?workspace_id=&funil_id=&q=&is_group=&id_canal=
 *
 * Board completo: 10 cards por coluna via `view_kanban_conversas` (`conversas.coluna_id` / `funil_id`).
 * Sem `funil_id`, usa o funil com `ordem = 1` do workspace.
 *
 * GET /api/kanban?workspace_id=&funil_id=&coluna_id=&offset=&q=&is_group=&id_canal=
 *
 * Paginação por coluna.
 *
 * `is_group=false` — só conversas 1:1 (inclui `is_group` null legado); omitido = todas.
 * `id_canal` / `canal_id` — filtra por canal; omitido = todos os canais.
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
  const funilIdFilter = parseFunilIdFilter(q.funil_id)
  const offset = parsePositiveInt(q.offset, 0)
  const searchRaw = parseSearchQuery(q.q ?? q.busca)
  const isGroupFilter = parseIsGroupFilter(q.is_group)
  const idCanalFilter = parseIdCanalFilter(q.id_canal ?? q.canal_id)

  const admin = serverSupabaseServiceRole<any>(event)

  let funilQuery = admin
    .from('funil_workspace')
    .select('id, nome')
    .eq('workspace_id', workspaceId)

  if (funilIdFilter != null) {
    funilQuery = funilQuery.eq('id', funilIdFilter)
  } else {
    funilQuery = funilQuery.eq('ordem', 1)
  }

  const { data: funil, error: funilErr } = await funilQuery.maybeSingle()

  if (funilErr) {
    throw createError({ statusCode: 500, statusMessage: funilErr.message })
  }

  if (!funil) {
    if (colunaIdFilter != null || funilIdFilter != null) {
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
      funilId,
      colunaIdFilter,
      offset,
      CARDS_PER_PAGE,
      searchRaw,
      isGroupFilter,
      idCanalFilter,
    )
    return {
      coluna_id: colunaIdFilter,
      ...page,
    }
  }

  const pages = await Promise.all(
    colunas.map((c) =>
      buildCardsPage(
        admin,
        workspaceId,
        funilId,
        c.id,
        0,
        CARDS_PER_PAGE,
        searchRaw,
        isGroupFilter,
        idCanalFilter,
      ),
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
