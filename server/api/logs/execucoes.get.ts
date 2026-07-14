import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import type {
  ListarWebhookExecucoesResponse,
  WebhookExecucaoResumo,
  WebhookExecucaoStatus,
} from '#shared/types/webhookExecucao'
import type { WebhookRequestOrigem } from '../../utils/webhookRequestOrigem'
import { createError, getQuery } from 'h3'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { checkAdmin } from '../../utils/checkAdmin'
import {
  execucaoPertenceAoWorkspace,
  listarCanalIdsDoWorkspace,
} from '../../utils/webhookExecucaoAcesso'
import {
  classificarRequestOrigem,
  extrairRequestHost,
} from '../../utils/webhookRequestOrigem'
import { getAuthUserId } from '../../utils/getAuthUserId'

const EXECUCOES_SELECT =
  'id, workspace_id, id_canal, event_type, instance_name, token_prefix, status, motivo_ignorado, erro_etapa, erro_mensagem, message_id, conversa_key, messagetype, phone, request_url, user_agent, iniciado_em, finalizado_em, duracao_ms, created_at'

const STATUS_VALIDOS: WebhookExecucaoStatus[] = ['processando', 'ignorado', 'sucesso', 'erro']
const ORIGENS_VALIDAS: WebhookRequestOrigem[] = ['ngrok', 'producao', 'outro']

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

function parseLimit(raw: unknown): number {
  const n = Number.parseInt(String(raw ?? '20').trim(), 10)
  if (!Number.isFinite(n) || n < 1) return 20
  return Math.min(n, 100)
}

function parseOffset(raw: unknown): number {
  const n = Number.parseInt(String(raw ?? '0').trim(), 10)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

function parseStatus(raw: unknown): WebhookExecucaoStatus | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  return STATUS_VALIDOS.includes(s as WebhookExecucaoStatus) ? (s as WebhookExecucaoStatus) : null
}

function parseIdCanal(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = Number.parseInt(String(raw).trim(), 10)
  return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : null
}

function parseOrigem(raw: unknown): WebhookRequestOrigem | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  return ORIGENS_VALIDAS.includes(s as WebhookRequestOrigem) ? (s as WebhookRequestOrigem) : null
}

/** ISO 8601 a partir de query (`de` / `ate`). */
function parseDatetimeIso(raw: unknown): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'Data/hora inválida no filtro.' })
  }
  return d.toISOString()
}

type CanalNomeRow = { id: number; nome: string | null }

function aplicarFiltroOrigemQuery(query: any, origem: WebhookRequestOrigem) {
  if (origem === 'ngrok') {
    return query.ilike('request_url', '%ngrok%')
  }
  if (origem === 'producao') {
    return query.or(
      'request_url.ilike.%whats.construzap.com%,request_url.ilike.%construzap.com%',
    )
  }
  return query.not('request_url', 'ilike', '%ngrok%').not('request_url', 'ilike', '%construzap%')
}

function enriquecerExecucao(
  row: Record<string, unknown>,
  canalNomes: Map<number, string | null>,
): WebhookExecucaoResumo {
  const idCanal = row.id_canal != null ? Number(row.id_canal) : null
  const requestUrl = typeof row.request_url === 'string' ? row.request_url : null
  const messagetypeRaw = row.messagetype ?? row.message_type ?? null

  return {
    id: String(row.id ?? ''),
    workspace_id: row.workspace_id != null ? Number(row.workspace_id) : null,
    id_canal: idCanal,
    event_type: typeof row.event_type === 'string' ? row.event_type : null,
    instance_name: typeof row.instance_name === 'string' ? row.instance_name : null,
    token_prefix: typeof row.token_prefix === 'string' ? row.token_prefix : null,
    status: row.status as WebhookExecucaoResumo['status'],
    motivo_ignorado: typeof row.motivo_ignorado === 'string' ? row.motivo_ignorado : null,
    erro_etapa: typeof row.erro_etapa === 'string' ? row.erro_etapa : null,
    erro_mensagem: typeof row.erro_mensagem === 'string' ? row.erro_mensagem : null,
    message_id: typeof row.message_id === 'string' ? row.message_id : null,
    conversa_key: typeof row.conversa_key === 'string' ? row.conversa_key : null,
    message_type: typeof messagetypeRaw === 'string' ? (messagetypeRaw as WebhookExecucaoResumo['message_type']) : null,
    phone: typeof row.phone === 'string' ? row.phone : null,
    request_url: requestUrl,
    user_agent: typeof row.user_agent === 'string' ? row.user_agent : null,
    iniciado_em: String(row.iniciado_em ?? ''),
    finalizado_em: row.finalizado_em != null ? String(row.finalizado_em) : null,
    duracao_ms: row.duracao_ms != null ? Number(row.duracao_ms) : null,
    created_at: String(row.created_at ?? ''),
    canal_nome: idCanal != null ? (canalNomes.get(idCanal) ?? null) : null,
    request_host: extrairRequestHost(requestUrl),
    request_origem: classificarRequestOrigem(requestUrl),
  }
}

/**
 * GET /api/logs/execucoes?workspace_id=&limit=&offset=&status=&id_canal=&de=&ate=&origem=
 *
 * Lista execuções do webhook Uazapi do workspace (resumo, sem payload/etapas).
 * Inclui logs por `workspace_id` OU por `id_canal` dos canais do workspace
 * (ngrok, produção ou qualquer host — o que importa é o POST em /api/webhook).
 */
export default defineEventHandler(async (event): Promise<ListarWebhookExecucoesResponse> => {
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
  const workspaceId = parseWorkspaceId(q.workspace_id)
  await checkAdmin(event, userId)
  await checkWorkspace(event, workspaceId, userId)

  const limit = parseLimit(q.limit)
  const offset = parseOffset(q.offset)
  const status = parseStatus(q.status)
  const idCanal = parseIdCanal(q.id_canal)
  const origem = parseOrigem(q.origem)
  const deIso = q.de != null && String(q.de).trim() ? parseDatetimeIso(q.de) : null
  const ateIso = q.ate != null && String(q.ate).trim() ? parseDatetimeIso(q.ate) : null

  if (deIso && ateIso && new Date(deIso).getTime() > new Date(ateIso).getTime()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'O início do período deve ser anterior ou igual ao fim.',
    })
  }

  const admin = serverSupabaseServiceRole<any>(event)

  let canalIdsWorkspace: number[] = []
  try {
    canalIdsWorkspace = await listarCanalIdsDoWorkspace(admin, workspaceId)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    throw createError({ statusCode: 500, statusMessage: msg })
  }

  let query = admin
    .from('webhook_uazapi_execucoes')
    .select(EXECUCOES_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })

  if (canalIdsWorkspace.length > 0) {
    query = query.or(
      `workspace_id.eq.${workspaceId},id_canal.in.(${canalIdsWorkspace.join(',')})`,
    )
  } else {
    query = query.eq('workspace_id', workspaceId)
  }

  if (status) {
    query = query.eq('status', status)
  }
  if (idCanal != null) {
    query = query.eq('id_canal', idCanal)
  }
  if (deIso) {
    query = query.gte('created_at', deIso)
  }
  if (ateIso) {
    query = query.lte('created_at', ateIso)
  }
  if (origem) {
    query = aplicarFiltroOrigemQuery(query, origem)
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const rows = (data ?? []).filter((row) =>
    execucaoPertenceAoWorkspace(row, workspaceId, canalIdsWorkspace),
  )

  const canalIdsNomes = [
    ...new Set(
      rows
        .map((r) => r.id_canal)
        .filter((id): id is number => id != null && Number.isFinite(Number(id)))
        .map((id) => Number(id)),
    ),
  ]

  const canalNomes = new Map<number, string | null>()
  if (canalIdsNomes.length > 0) {
    const { data: canaisRows, error: canaisErr } = await admin
      .from('canais')
      .select('id, nome')
      .in('id', canalIdsNomes)

    if (canaisErr) {
      throw createError({ statusCode: 500, statusMessage: canaisErr.message })
    }

    for (const row of (canaisRows ?? []) as CanalNomeRow[]) {
      if (row.id != null) canalNomes.set(row.id, row.nome ?? null)
    }
  }

  const execucoes = rows.map((row) => enriquecerExecucao(row, canalNomes))

  return {
    execucoes,
    total: count ?? execucoes.length,
  }
})
