import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { Cobranca, StatusContratoCobranca } from '#shared/types/cobranca'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

type Body = {
  id?: unknown
  workspace_id?: unknown
  status_contrato?: unknown
}

function parsePositiveInt(raw: unknown, label: string): number {
  const s = String(raw ?? '').trim()
  if (!s) {
    throw createError({ statusCode: 400, statusMessage: `${label} é obrigatório.` })
  }
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  return n
}

function parseStatus(raw: unknown): StatusContratoCobranca {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s === 'ativo' || s === 'vencida' || s === 'finalizado' || s === 'cancelado') return s
  throw createError({
    statusCode: 400,
    statusMessage: 'status_contrato inválido (use ativo, vencida, finalizado ou cancelado).',
  })
}

function toNumber(raw: unknown, fallback = 0): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  const n = Number.parseFloat(String(raw ?? ''))
  return Number.isFinite(n) ? n : fallback
}

/**
 * POST /api/cobranca/atualizarstatus
 * Atualiza apenas `status_contrato` da cobrança.
 */
export default defineEventHandler(async (event): Promise<{ cobranca: Pick<Cobranca, 'id' | 'status_contrato' | 'updated_at'> }> => {
  assertMethod(event, 'POST')

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
  const cobrancaId = parsePositiveInt(body.id, 'id')
  const workspaceId = parsePositiveInt(body.workspace_id, 'workspace_id')
  const statusContrato = parseStatus(body.status_contrato)
  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)
  const nowIso = new Date().toISOString()

  const { data, error } = await admin
    .from('cobranca')
    .update({
      status_contrato: statusContrato,
      updated_at: nowIso,
    })
    .eq('id', cobrancaId)
    .eq('workspace_id', workspaceId)
    .select('id, status_contrato, updated_at')
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Cobrança não encontrada.' })
  }

  const row = data as Record<string, unknown>
  return {
    cobranca: {
      id: toNumber(row.id),
      status_contrato: String(row.status_contrato ?? statusContrato) as StatusContratoCobranca,
      updated_at: row.updated_at == null ? null : String(row.updated_at),
    },
  }
})
