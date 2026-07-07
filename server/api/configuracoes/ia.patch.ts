import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { WorkspaceConfiguracoes } from '#shared/types/configuracoes'
import {
  ehDestinoNotificacaoValido,
  MENSAGEM_DESTINO_NOTIFICACAO_INVALIDO,
} from '#shared/utils/validarDestinoNotificacao'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

type Body = {
  workspace_id?: unknown
  nome?: unknown
  descricao?: unknown
  fase_teste?: unknown
  numero_testes?: unknown
  numero_notificacao?: unknown
  tempo_resposta?: unknown
  tempo_pausa?: unknown
  coluna_origem_leads?: unknown
}

const TELEFONE_REGEX = /^[0-9]{12,13}$/

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

function parseNome(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Informe o nome.' })
  }
  const trimmed = raw.trim()
  if (!trimmed) {
    throw createError({ statusCode: 400, statusMessage: 'Informe o nome.' })
  }
  return trimmed
}

function parseDescricao(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Descrição inválida.' })
  }
  const trimmed = raw.trim()
  return trimmed.length ? trimmed : null
}

function parseFaseTeste(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw
  throw createError({ statusCode: 400, statusMessage: 'fase_teste inválido.' })
}

function parseTelefoneOpcional(raw: unknown, label: string): string | null {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw !== 'string') {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  const trimmed = raw.trim()
  if (!trimmed.length) return null
  if (!TELEFONE_REGEX.test(trimmed)) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'Número inválido. Use: (55 + DDD + 9 + os 8 dígitos, sem espaços). Exemplo: 5571988570826',
    })
  }
  return trimmed
}

function parseNotificacaoOpcional(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'numero_notificacao inválido.' })
  }
  const trimmed = raw.trim()
  if (!trimmed.length) return null
  if (!ehDestinoNotificacaoValido(trimmed)) {
    throw createError({
      statusCode: 400,
      statusMessage: MENSAGEM_DESTINO_NOTIFICACAO_INVALIDO,
    })
  }
  return trimmed
}

/** Aceita id numérico ou string; `0` / vazio → null (limpa seleção). */
function parseColunaOrigemLeads(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  const n =
    typeof raw === 'number' && Number.isFinite(raw)
      ? Math.trunc(raw)
      : Number.parseInt(String(raw).trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw createError({ statusCode: 400, statusMessage: 'coluna_origem_leads inválido.' })
  }
  if (n < 1) return null
  return n
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

function parseInteiroNaoNegativo(raw: unknown, label: string, padrao: number): number {
  if (raw === null || raw === undefined || raw === '') return padrao
  const n =
    typeof raw === 'number' && Number.isFinite(raw)
      ? Math.trunc(raw)
      : Number.parseInt(String(raw).trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  return n
}

function mapRow(row: Record<string, unknown>): WorkspaceConfiguracoes {
  const nome = typeof row.nome === 'string' ? row.nome : ''
  const descricao =
    typeof row.descricao === 'string' && row.descricao.trim().length ? row.descricao.trim() : null
  const numeroTestes =
    typeof row.numero_testes === 'string' && row.numero_testes.trim().length
      ? row.numero_testes.trim()
      : null
  const numeroNotificacao =
    typeof row.numero_notificacao === 'string' && row.numero_notificacao.trim().length
      ? row.numero_notificacao.trim()
      : null

  return {
    nome,
    descricao,
    fase_teste: row.fase_teste !== false,
    numero_testes: numeroTestes,
    numero_notificacao: numeroNotificacao,
    tempo_resposta:
      typeof row.tempo_resposta === 'number' && Number.isFinite(row.tempo_resposta)
        ? Math.trunc(row.tempo_resposta)
        : 10,
    tempo_pausa:
      typeof row.tempo_pausa === 'number' && Number.isFinite(row.tempo_pausa)
        ? Math.trunc(row.tempo_pausa)
        : 28800,
    coluna_origem_leads: colunaOrigemLeadsParaApi(row.coluna_origem_leads),
  }
}

/**
 * PATCH /api/configuracoes/ia
 *
 * Body: configurações editáveis do workspace (`nome`, `descricao`, `fase_teste`, `numero_testes`, `numero_notificacao`, `tempo_resposta`, `tempo_pausa`, `coluna_origem_leads`).
 */
export default defineEventHandler(async (event): Promise<WorkspaceConfiguracoes> => {
  assertMethod(event, 'PATCH')

  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const body = (await readBody<Body>(event).catch(() => null)) ?? {}
  const workspaceId = parseWorkspaceId(body.workspace_id)
  const nome = parseNome(body.nome)
  const descricao = parseDescricao(body.descricao)
  const faseTeste = parseFaseTeste(body.fase_teste)
  const numeroTestes = parseTelefoneOpcional(body.numero_testes, 'numero_testes')
  const numeroNotificacao = parseNotificacaoOpcional(body.numero_notificacao)
  const tempoResposta = parseInteiroNaoNegativo(body.tempo_resposta, 'tempo_resposta', 10)
  const tempoPausa = parseInteiroNaoNegativo(body.tempo_pausa, 'tempo_pausa', 28800)
  const colunaOrigemLeads = parseColunaOrigemLeads(body.coluna_origem_leads)

  await checkWorkspace(event, workspaceId, userId)

  if (faseTeste) {
    if (!numeroTestes) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Informe o número de telefone para a fase de teste.',
      })
    }
  }

  const admin = serverSupabaseServiceRole<any>(event)

  if (colunaOrigemLeads != null) {
    const { data: funil, error: funilErr } = await admin
      .from('funil_workspace')
      .select('id')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (funilErr) {
      throw createError({ statusCode: 500, statusMessage: funilErr.message })
    }
    const funilId =
      funil?.id != null
        ? typeof funil.id === 'number'
          ? funil.id
          : Number(funil.id)
        : NaN
    if (!Number.isFinite(funilId) || funilId < 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Funil não encontrado para este workspace.',
      })
    }

    const { data: coluna, error: colErr } = await admin
      .from('funil_workspace_colunas')
      .select('id')
      .eq('id', colunaOrigemLeads)
      .eq('funil_id', funilId)
      .is('deleted_at', null)
      .maybeSingle()

    if (colErr) {
      throw createError({ statusCode: 500, statusMessage: colErr.message })
    }
    if (!coluna) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Coluna origem dos leads inválida ou não pertence ao funil deste workspace.',
      })
    }
  }

  const { data, error } = await admin
    .from('workspace')
    .update({
      nome,
      descricao,
      fase_teste: faseTeste,
      numero_testes: faseTeste ? numeroTestes : null,
      numero_notificacao: numeroNotificacao,
      tempo_resposta: tempoResposta,
      tempo_pausa: tempoPausa,
      coluna_origem_leads: colunaOrigemLeads,
    })
    .eq('id', workspaceId)
    .is('deleted_at', null)
    .is('deleted_by', null)
    .select('nome, descricao, fase_teste, numero_testes, numero_notificacao, tempo_resposta, tempo_pausa, coluna_origem_leads')
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Workspace não encontrado.' })
  }

  return mapRow(data as Record<string, unknown>)
})
