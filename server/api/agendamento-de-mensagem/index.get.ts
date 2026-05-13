import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import type { AgendamentoMensagemListItem, AgendamentoMensagemListResponse } from '#shared/types/agendamentoMensagens'
import { assertMethod, createError, getQuery } from 'h3'
import { DateTime } from 'luxon'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

const ZONE = 'America/Sao_Paulo'
const MAX_PAGE_SIZE = 500
const DEFAULT_PAGE_SIZE = 200

const SELECT =
  'id, nomecliente, telefone, mensagem_type, mensagem_texto, midia_url, data_agendada, iana_timezone, recorrente, intervalo_recorrencia, status, id_canal'

function mapListRow(r: Record<string, unknown>): AgendamentoMensagemListItem {
  const idRaw = r.id
  const id = typeof idRaw === 'number' ? idRaw : Number(idRaw)
  if (!Number.isFinite(id) || !Number.isInteger(id) || id < 1) {
    throw createError({ statusCode: 500, statusMessage: 'Resposta inválida: id do agendamento.' })
  }

  const recRaw = r.recorrente
  const recorrente: boolean | null =
    recRaw == null ? null : recRaw === true || String(recRaw).toLowerCase() === 'true'

  let intervalo: string | null = null
  const ir = r.intervalo_recorrencia
  if (ir != null && ir !== '') {
    intervalo = typeof ir === 'string' ? ir : String(ir)
  }

  const id_canal_raw = r.id_canal
  const id_canal =
    id_canal_raw == null || id_canal_raw === ''
      ? null
      : (() => {
          const n = typeof id_canal_raw === 'number' ? id_canal_raw : Number(id_canal_raw)
          return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : null
        })()

  return {
    id,
    nomecliente: r.nomecliente != null ? String(r.nomecliente) : null,
    telefone: r.telefone != null ? String(r.telefone) : null,
    mensagem_type: r.mensagem_type != null ? String(r.mensagem_type) : null,
    mensagem_texto: r.mensagem_texto != null ? String(r.mensagem_texto) : null,
    midia_url: r.midia_url != null ? String(r.midia_url) : null,
    data_agendada: String(r.data_agendada ?? ''),
    iana_timezone: r.iana_timezone != null ? String(r.iana_timezone) : null,
    recorrente,
    intervalo_recorrencia: intervalo,
    status: r.status != null ? String(r.status) : null,
    id_canal,
  }
}

function parseYearMonth(rawYear: unknown, rawMonth: unknown): { year: number; month: number } {
  const year =
    typeof rawYear === 'number' && Number.isInteger(rawYear)
      ? rawYear
      : Number.parseInt(String(rawYear ?? '').trim(), 10)
  const month =
    typeof rawMonth === 'number' && Number.isInteger(rawMonth)
      ? rawMonth
      : Number.parseInt(String(rawMonth ?? '').trim(), 10)
  if (!Number.isFinite(year) || !Number.isInteger(year) || year < 2000 || year > 2100) {
    throw createError({ statusCode: 400, statusMessage: 'year inválido (2000–2100).' })
  }
  if (!Number.isFinite(month) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw createError({ statusCode: 400, statusMessage: 'month inválido (1–12).' })
  }
  return { year, month }
}

function parsePositiveInt(raw: unknown, fallback: number, max?: number): number {
  const n =
    typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || n < 1) return fallback
  if (max != null && n > max) return max
  return n
}

function inicioFimMesUtcIso(year: number, month: number): { fromIso: string; toIso: string } {
  const start = DateTime.fromObject({ year, month, day: 1 }, { zone: ZONE }).startOf('day')
  const end = start.plus({ months: 1 })
  const fromIso = start.toUTC().toISO()
  const toIso = end.toUTC().toISO()
  if (!fromIso || !toIso) {
    throw createError({ statusCode: 500, statusMessage: 'Falha ao calcular intervalo do mês.' })
  }
  return { fromIso, toIso }
}

/**
 * GET /api/agendamento-de-mensagem?workspace_id=&year=&month=&page=&page_size=
 *
 * Lista agendamentos do workspace no mês civil (America/Sao_Paulo), paginado.
 */
export default defineEventHandler(async (event): Promise<AgendamentoMensagemListResponse> => {
  assertMethod(event, 'GET')

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

  const { year, month } = parseYearMonth(q.year, q.month)

  const page = parsePositiveInt(q.page, 1)
  const pageSize = parsePositiveInt(q.page_size ?? q.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)

  const { fromIso, toIso } = inicioFimMesUtcIso(year, month)
  const fromIx = (page - 1) * pageSize
  const toIx = fromIx + pageSize - 1

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data, error, count } = await admin
    .from('agendamentos_mensagens')
    .select(SELECT, { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .gte('data_agendada', fromIso)
    .lt('data_agendada', toIso)
    .order('data_agendada', { ascending: true })
    .range(fromIx, toIx)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const rows = (data ?? []) as Record<string, unknown>[]
  const total = typeof count === 'number' && count >= 0 ? count : rows.length

  return {
    items: rows.map(mapListRow),
    total,
    page,
    page_size: pageSize,
  }
})
