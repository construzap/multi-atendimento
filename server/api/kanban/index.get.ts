import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type { KanbanBoardResponse, KanbanCard, KanbanColumn } from '#shared/types/kanban'
import { getAuthUserId } from '../../utils/getAuthUserId'
import { checkWorkspace } from '../../utils/checkWorkspace'

type ConvEmbed = {
  name: string | null
  phone: string | null
  photo: string | null
  message: string | null
  updated_at: string | null
  id_canal: number | null
}

type StatusRow = {
  conversa_key: string
  coluna_id: number
  prioridade: number | null
  /** Supabase pode devolver objeto ou array de 1 elemento no join. */
  conversas: ConvEmbed | ConvEmbed[] | null
}

/**
 * GET /api/kanban?workspace_id=
 *
 * Monta o board: funil do workspace, colunas ordenadas e cards por `funil_conversa_status`
 * com dados de `conversas`.
 */
export default defineEventHandler(async (event): Promise<KanbanBoardResponse> => {
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

  const { data: statusRows, error: stErr } = await admin
    .from('funil_conversa_status')
    .select(
      'conversa_key, coluna_id, prioridade, conversas(name, phone, photo, message, updated_at, id_canal)',
    )
    .eq('workspace_id', workspaceId)

  if (stErr) {
    throw createError({ statusCode: 500, statusMessage: stErr.message })
  }

  const rows = (statusRows ?? []) as StatusRow[]
  const canalIds = new Set<number>()
  for (const row of rows) {
    const rawConv = row.conversas
    const conv = Array.isArray(rawConv) ? rawConv[0] ?? null : rawConv
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

  const nomePorCanalId = new Map<number, string>()
  if (canalIds.size > 0) {
    const { data: canaisRows, error: canaisErr } = await admin
      .from('canais')
      .select('id, nome')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .in('id', [...canalIds])

    if (canaisErr) {
      throw createError({ statusCode: 500, statusMessage: canaisErr.message })
    }

    for (const r of canaisRows ?? []) {
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
  }

  const byColId = new Map<number, KanbanCard[]>()
  for (const c of colunas) {
    byColId.set(c.id, [])
  }

  for (const row of rows) {
    const rawConv = row.conversas
    const conv = Array.isArray(rawConv) ? rawConv[0] ?? null : rawConv
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

    const card: KanbanCard = {
      conversa_key: row.conversa_key,
      coluna_id: row.coluna_id,
      prioridade:
        row.prioridade != null && Number.isFinite(Number(row.prioridade))
          ? Number(row.prioridade)
          : null,
      name: conv && typeof conv === 'object' && 'name' in conv ? (conv as { name: string | null }).name : null,
      phone: conv && typeof conv === 'object' && 'phone' in conv ? (conv as { phone: string | null }).phone : null,
      photo: conv && typeof conv === 'object' && 'photo' in conv ? (conv as { photo: string | null }).photo : null,
      preview: conv && typeof conv === 'object' && 'message' in conv ? (conv as { message: string | null }).message : null,
      updated_at: conv && typeof conv === 'object' && 'updated_at' in conv ? (conv as { updated_at: string | null }).updated_at : null,
      canal_nome: canalNome,
    }

    const list = byColId.get(row.coluna_id)
    if (list) {
      list.push(card)
    }
  }

  const columns: KanbanColumn[] = colunas.map((c) => ({
    id: c.id,
    nome: c.nome,
    cor: c.cor,
    ordem: c.ordem,
    cards: byColId.get(c.id) ?? [],
  }))

  return {
    funil_id: funilId,
    funil_nome: funilNome,
    columns,
  }
})
