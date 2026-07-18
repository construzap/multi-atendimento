import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type {
  Cobranca,
  FrequenciaCobranca,
  FrequenciaRecorrencia,
  ListarCobrancasResponse,
  TipoCobranca,
} from '#shared/types/cobranca'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

function parseWorkspaceId(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') {
    throw createError({ statusCode: 400, statusMessage: 'Informe workspace_id na query.' })
  }
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }
  return n
}

function toNumber(raw: unknown, fallback = 0): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  const n = Number.parseFloat(String(raw ?? ''))
  return Number.isFinite(n) ? n : fallback
}

function mapCobranca(row: Record<string, unknown>): Cobranca {
  return {
    id: toNumber(row.id),
    workspace_id: toNumber(row.workspace_id),
    canal_id: toNumber(row.canal_id),
    conversa_key: String(row.conversa_key ?? ''),
    phone: String(row.phone ?? ''),
    name: row.name == null || String(row.name).trim() === '' ? null : String(row.name).trim(),
    tipo_cobranca: String(row.tipo_cobranca ?? 'unico') as TipoCobranca,
    valor_total: toNumber(row.valor_total),
    status_contrato: (String(row.status_contrato ?? 'ativo') as Cobranca['status_contrato']),
    total_parcelas: row.total_parcelas == null ? null : toNumber(row.total_parcelas),
    frequencia_recorrencia:
      row.frequencia_recorrencia == null
        ? null
        : (String(row.frequencia_recorrencia) as FrequenciaRecorrencia),
    frequencia_cobranca:
      row.frequencia_cobranca == null
        ? null
        : (String(row.frequencia_cobranca) as FrequenciaCobranca),
    data_proxima_notificacao:
      row.data_proxima_notificacao == null
        ? null
        : String(row.data_proxima_notificacao),
    iana_timezone:
      row.iana_timezone == null || String(row.iana_timezone).trim() === ''
        ? null
        : String(row.iana_timezone).trim(),
    dia_vencimento: toNumber(row.dia_vencimento),
    data_inicio: String(row.data_inicio ?? ''),
    data_fim: row.data_fim == null ? null : String(row.data_fim),
    porcentagem_multa: row.porcentagem_multa == null ? null : toNumber(row.porcentagem_multa),
    porcentagem_juros_mes:
      row.porcentagem_juros_mes == null ? null : toNumber(row.porcentagem_juros_mes),
    template_mensagem: String(row.template_mensagem ?? ''),
    template_mensagem_vencida: String(row.template_mensagem_vencida ?? ''),
    data_vencimento:
      row.data_vencimento == null ? null : String(row.data_vencimento),
    created_at: String(row.created_at ?? ''),
    updated_at: row.updated_at == null ? null : String(row.updated_at),
  }
}

/**
 * GET /api/cobranca?workspace_id=
 * Lista cobranças do workspace (todos os campos da tabela `cobranca`, sem produtos).
 */
export default defineEventHandler(async (event): Promise<ListarCobrancasResponse> => {
  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const workspaceId = parseWorkspaceId(getQuery(event).workspace_id)
  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)
  const { data, error } = await admin
    .from('cobranca')
    .select(
      'id, workspace_id, canal_id, conversa_key, phone, name, tipo_cobranca, valor_total, status_contrato, total_parcelas, frequencia_recorrencia, frequencia_cobranca, dia_vencimento, data_inicio, data_fim, porcentagem_multa, porcentagem_juros_mes, template_mensagem, created_at, updated_at, data_proxima_notificacao, iana_timezone, data_vencimento, template_mensagem_vencida',
    )
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return {
    data: ((data ?? []) as Record<string, unknown>[]).map(mapCobranca),
  }
})
