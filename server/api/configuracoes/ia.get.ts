import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getQuery } from 'h3'
import type { WorkspaceConfiguracoes } from '#shared/types/configuracoes'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

function parsePositiveInt(raw: unknown, label: string): number {
  const s = String(raw ?? '').trim()
  if (!s) {
    throw createError({ statusCode: 400, statusMessage: `${label} é obrigatório.` })
  }
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  if (String(n) !== s) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  return n
}

function textoOuNull(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed.length ? trimmed : null
}

function inteiroOuPadrao(raw: unknown, padrao: number): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw)
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number.parseInt(raw.trim(), 10)
    if (Number.isFinite(n)) return n
  }
  return padrao
}

/** `workspace.coluna_origem_leads` é bigint no banco; API expõe string do id. */
function colunaOrigemLeadsParaApi(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null
  const n =
    typeof raw === 'number' && Number.isFinite(raw)
      ? Math.trunc(raw)
      : Number.parseInt(String(raw).trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  return String(n)
}

/**
 * GET /api/configuracoes/ia?workspace_id=
 *
 * Retorna as configurações editáveis do workspace.
 */
export default defineEventHandler(async (event): Promise<WorkspaceConfiguracoes> => {
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
  const workspaceId = parsePositiveInt(q.workspace_id, 'workspace_id')
  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)
  const { data, error } = await admin
    .from('workspace')
    .select(
      'nome, descricao, fase_teste, numero_testes, numero_notificacao, tempo_resposta, tempo_pausa, coluna_origem_leads',
    )
    .eq('id', workspaceId)
    .is('deleted_at', null)
    .is('deleted_by', null)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Workspace não encontrado.' })
  }

  const row = data as {
    nome?: unknown
    descricao?: unknown
    fase_teste?: unknown
    numero_testes?: unknown
    numero_notificacao?: unknown
    tempo_resposta?: unknown
    tempo_pausa?: unknown
    coluna_origem_leads?: unknown
  }

  return {
    nome: typeof row.nome === 'string' ? row.nome : '',
    descricao: textoOuNull(row.descricao),
    fase_teste: row.fase_teste !== false,
    numero_testes: textoOuNull(row.numero_testes),
    numero_notificacao: textoOuNull(row.numero_notificacao),
    tempo_resposta: inteiroOuPadrao(row.tempo_resposta, 10),
    tempo_pausa: inteiroOuPadrao(row.tempo_pausa, 28800),
    coluna_origem_leads: colunaOrigemLeadsParaApi(row.coluna_origem_leads),
  }
})
