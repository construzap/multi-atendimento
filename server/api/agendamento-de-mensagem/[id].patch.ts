import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { isIanaFusoBrasilPermitido } from '#shared/constants/ianaTimezonesBrasil'
import type {
  AgendamentoMensagemRecorrenciaInserir,
  AgendamentoMensagemRow,
  AgendamentoMensagemTipo,
} from '#shared/types/agendamentoMensagens'
import { parseDataHoraLocalBrasilParaUtcIso } from '#shared/utils/agendamentoDataUtc'
import { normalizeTelefoneBrParaEnvio } from '#shared/utils/normalizeWhatsappBr'
import { assertMethod, createError, getRouterParam, readBody } from 'h3'
import { checkChannel } from '../../utils/checkChannel'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

type Body = Record<string, unknown>

function parseIdAgendamento(raw: string | undefined): number {
  const n = Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'id do agendamento inválido.' })
  }
  return n
}

function parseIdCanal(raw: unknown): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'id_canal inválido.' })
  }
  return n
}

function parseWorkspaceId(raw: unknown): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }
  return n
}

function parseMensagemType(raw: unknown): AgendamentoMensagemTipo {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s === 'texto' || s === 'imagem' || s === 'audio') return s
  throw createError({ statusCode: 400, statusMessage: 'mensagem_type deve ser texto, imagem ou audio.' })
}

function trimOrNull(raw: unknown): string | null {
  const t = String(raw ?? '').trim()
  return t.length > 0 ? t : null
}

function parseDataLocal(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw createError({ statusCode: 400, statusMessage: 'data_local inválida (use yyyy-mm-dd).' })
  }
  return s
}

function parseHoraLocal(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!/^\d{1,2}:\d{2}$/.test(s)) {
    throw createError({ statusCode: 400, statusMessage: 'hora_local inválida (use HH:mm).' })
  }
  return s
}

function parseIanaTimezone(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!s) {
    throw createError({ statusCode: 400, statusMessage: 'iana_timezone é obrigatório.' })
  }
  if (!isIanaFusoBrasilPermitido(s)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'iana_timezone não é um fuso do Brasil permitido.',
    })
  }
  return s
}

function parseRecorrencia(raw: unknown): AgendamentoMensagemRecorrenciaInserir {
  const s = String(raw ?? 'unico').trim().toLowerCase()
  if (s === 'unico' || s === 'diaria' || s === 'semanal' || s === 'mensal' || s === 'anual') return s
  return 'unico'
}

function recorrenciaParaDb(
  r: AgendamentoMensagemRecorrenciaInserir,
): { recorrente: boolean; intervalo_recorrencia: string | null } {
  switch (r) {
    case 'diaria':
      return { recorrente: true, intervalo_recorrencia: '1 day' }
    case 'semanal':
      return { recorrente: true, intervalo_recorrencia: '7 days' }
    case 'mensal':
      return { recorrente: true, intervalo_recorrencia: '1 month' }
    case 'anual':
      return { recorrente: true, intervalo_recorrencia: '1 year' }
    default:
      return { recorrente: false, intervalo_recorrencia: null }
  }
}

function mapRow(r: Record<string, unknown>): AgendamentoMensagemRow {
  const id = typeof r.id === 'number' ? r.id : Number(r.id)
  const workspace_id = typeof r.workspace_id === 'number' ? r.workspace_id : Number(r.workspace_id)
  const rec =
    typeof r.recorrente === 'boolean'
      ? r.recorrente
      : r.recorrente === true || String(r.recorrente).toLowerCase() === 'true'
  let intervalo: string | null = null
  const ir = r.intervalo_recorrencia
  if (ir != null && ir !== '') {
    intervalo = typeof ir === 'string' ? ir : String(ir)
  }
  const id_canal_raw = r.id_canal
  const id_canal_parsed =
    id_canal_raw == null || id_canal_raw === ''
      ? null
      : (() => {
          const n = typeof id_canal_raw === 'number' ? id_canal_raw : Number(id_canal_raw)
          return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : null
        })()

  return {
    id: Number.isFinite(id) ? id : 0,
    created_at: r.created_at != null ? String(r.created_at) : null,
    workspace_id: Number.isFinite(workspace_id) ? workspace_id : 0,
    id_canal: id_canal_parsed,
    nomecliente: r.nomecliente != null ? String(r.nomecliente) : null,
    telefone: r.telefone != null ? String(r.telefone) : null,
    mensagem_type: r.mensagem_type != null ? String(r.mensagem_type) : null,
    mensagem_texto: r.mensagem_texto != null ? String(r.mensagem_texto) : null,
    midia_url: r.midia_url != null ? String(r.midia_url) : null,
    data_agendada: String(r.data_agendada ?? ''),
    iana_timezone: r.iana_timezone != null ? String(r.iana_timezone) : null,
    status: r.status != null ? String(r.status) : null,
    recorrente: Boolean(rec),
    intervalo_recorrencia: intervalo,
  }
}

/**
 * PATCH /api/agendamento-de-mensagem/:id
 *
 * Atualiza linha em `agendamentos_mensagens` do workspace (após `checkWorkspace` e canal).
 */
export default defineEventHandler(async (event): Promise<AgendamentoMensagemRow> => {
  assertMethod(event, 'PATCH')

  const agendamentoId = parseIdAgendamento(getRouterParam(event, 'id'))

  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const bodyRaw = (await readBody<Body>(event).catch(() => null)) ?? {}
  const workspaceId = parseWorkspaceId(bodyRaw.workspace_id)
  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: existente, error: exErr } = await admin
    .from('agendamentos_mensagens')
    .select('id, workspace_id')
    .eq('id', agendamentoId)
    .maybeSingle()

  if (exErr) {
    throw createError({ statusCode: 500, statusMessage: exErr.message })
  }
  if (!existente) {
    throw createError({ statusCode: 404, statusMessage: 'Agendamento não encontrado.' })
  }
  const wsEx =
    typeof (existente as { workspace_id?: unknown }).workspace_id === 'number'
      ? (existente as { workspace_id: number }).workspace_id
      : Number((existente as { workspace_id?: unknown }).workspace_id)
  if (!Number.isFinite(wsEx) || wsEx !== workspaceId) {
    throw createError({ statusCode: 403, statusMessage: 'Agendamento não pertence a este workspace.' })
  }

  const id_canal = parseIdCanal(bodyRaw.id_canal)
  const { data: canalRow, error: canalErr } = await admin
    .from('canais')
    .select('id, workspace_id')
    .eq('id', id_canal)
    .is('deleted_at', null)
    .is('deleted_by', null)
    .maybeSingle()

  if (canalErr) {
    throw createError({ statusCode: 500, statusMessage: canalErr.message })
  }
  if (!canalRow) {
    throw createError({ statusCode: 400, statusMessage: 'Canal não encontrado ou removido.' })
  }
  const canalWs =
    typeof (canalRow as { workspace_id?: unknown }).workspace_id === 'number'
      ? (canalRow as { workspace_id: number }).workspace_id
      : Number((canalRow as { workspace_id?: unknown }).workspace_id)
  if (!Number.isFinite(canalWs) || canalWs !== workspaceId) {
    throw createError({ statusCode: 400, statusMessage: 'Canal não pertence ao workspace informado.' })
  }
  const podeCanal = await checkChannel(event, id_canal, userId)
  if (!podeCanal) {
    throw createError({ statusCode: 403, statusMessage: 'Sem permissão para usar este canal.' })
  }

  const mensagem_type = parseMensagemType(bodyRaw.mensagem_type)
  if (mensagem_type === 'imagem' || mensagem_type === 'audio') {
    const mu = trimOrNull(bodyRaw.midia_url)
    if (!mu) {
      throw createError({
        statusCode: 400,
        statusMessage:
          'Para imagem ou áudio informe midia_url (URL existente ou retornada por upload-midia).',
      })
    }
  }

  const data_local = parseDataLocal(bodyRaw.data_local)
  const hora_local = parseHoraLocal(bodyRaw.hora_local)
  const iana_timezone = parseIanaTimezone(bodyRaw.iana_timezone)

  const data_agendada_iso = parseDataHoraLocalBrasilParaUtcIso(data_local, hora_local, iana_timezone)
  if (!data_agendada_iso) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Combinação inválida de data_local, hora_local e iana_timezone.',
    })
  }

  const nomecliente = trimOrNull(bodyRaw.nomecliente)
  const telefoneBruto = trimOrNull(bodyRaw.telefone)
  const telefoneDigits = telefoneBruto ? normalizeTelefoneBrParaEnvio(telefoneBruto) : ''
  const telefone = telefoneDigits.length > 0 ? telefoneDigits : null
  const mensagem_texto = trimOrNull(bodyRaw.mensagem_texto)
  const midia_url = trimOrNull(bodyRaw.midia_url)
  const { recorrente, intervalo_recorrencia } = recorrenciaParaDb(parseRecorrencia(bodyRaw.recorrencia))

  const updateRow = {
    id_canal,
    nomecliente,
    telefone,
    mensagem_type,
    mensagem_texto,
    midia_url,
    data_agendada: data_agendada_iso,
    iana_timezone,
    recorrente,
    intervalo_recorrencia,
  }

  const { data, error } = await admin
    .from('agendamentos_mensagens')
    .update(updateRow)
    .eq('id', agendamentoId)
    .eq('workspace_id', workspaceId)
    .select(
      'id, created_at, workspace_id, id_canal, nomecliente, telefone, mensagem_type, mensagem_texto, midia_url, data_agendada, iana_timezone, status, recorrente, intervalo_recorrencia',
    )
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Não foi possível atualizar o agendamento.' })
  }

  return mapRow(data as Record<string, unknown>)
})
