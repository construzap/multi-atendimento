import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, readBody } from 'h3'
import type { CanalPagamentoInfo } from '#shared/types/canal'
import {
  mapCanalPagamentoRow,
  parseProvedorPagamentos,
  parseTaxasCartaoParaSalvar,
} from '../../../utils/canalPagamento'
import { getAgenteSenhaMestraPassphrase } from '../../../utils/agente/getAgenteSenhaMestraPassphrase'
import { setCanalCredenciaisPagarmeEncrypted } from '../../../utils/encryptCanalCredenciaisPagarme'
import { getAuthUserId } from '../../../utils/getAuthUserId'
import { checkChannel } from '../../../utils/checkChannel'
import { checkWorkspace } from '../../../utils/checkWorkspace'

type Body = {
  workspace_id?: number | string
  id?: number | string
  id_canal?: number | string
  provedor_pagamentos?: string | null
  chave_pix?: string | null
  /** Texto plano — criptografado no servidor se enviado. */
  credenciais?: string | null
  credenciais_pagarme?: string | null
  taxas_cartao?: unknown
}

const SELECT =
  'id, workspace_id, provedor_pagamentos, chave_pix, credenciais_encrypted, taxas_cartao'

/**
 * POST /api/canais/pagamento
 * Atualiza pagamento do canal. Credenciais em texto plano são criptografadas
 * com a senha mestra (pgp_sym_encrypt).
 */
export default defineEventHandler(async (event): Promise<CanalPagamentoInfo> => {
  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const body = (await readBody<Body>(event)) ?? {}

  const rawWs = body.workspace_id
  if (rawWs === undefined || rawWs === null || rawWs === '') {
    throw createError({ statusCode: 400, statusMessage: 'Informe workspace_id.' })
  }
  const workspaceId =
    typeof rawWs === 'number' ? rawWs : Number.parseInt(String(rawWs), 10)
  if (!Number.isFinite(workspaceId) || !Number.isInteger(workspaceId) || workspaceId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }

  const rawCanal = body.id ?? body.id_canal
  if (rawCanal === undefined || rawCanal === null || rawCanal === '') {
    throw createError({ statusCode: 400, statusMessage: 'Informe id (canal).' })
  }
  const canalId =
    typeof rawCanal === 'number' ? rawCanal : Number.parseInt(String(rawCanal), 10)
  if (!Number.isFinite(canalId) || !Number.isInteger(canalId) || canalId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'id (canal) inválido.' })
  }

  await checkWorkspace(event, workspaceId, userId)

  const owns = await checkChannel(event, canalId, userId)
  if (!owns) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Canal não encontrado ou sem permissão.',
    })
  }

  const provedorRaw = body.provedor_pagamentos
  let provedor: ReturnType<typeof parseProvedorPagamentos> | null | undefined
  if (provedorRaw === null || provedorRaw === '') {
    provedor = null
  } else if (provedorRaw !== undefined) {
    provedor = parseProvedorPagamentos(provedorRaw)
    if (provedor == null) {
      throw createError({
        statusCode: 400,
        statusMessage: 'provedor_pagamentos inválido (use pagar.me ou asaas).',
      })
    }
  }

  const chavePix =
    body.chave_pix === undefined
      ? undefined
      : typeof body.chave_pix === 'string'
        ? body.chave_pix.trim() || null
        : null

  const taxas =
    body.taxas_cartao === undefined
      ? undefined
      : parseTaxasCartaoParaSalvar(body.taxas_cartao)

  const credenciaisPlain = String(
    body.credenciais ?? body.credenciais_pagarme ?? '',
  ).trim()

  const patch: Record<string, unknown> = {}
  if (provedor !== undefined) patch.provedor_pagamentos = provedor
  // Asaas não usa chave PIX no canal — não altera a coluna ao salvar.
  if (chavePix !== undefined && provedor !== 'asaas') patch.chave_pix = chavePix
  if (taxas !== undefined) patch.taxas_cartao = taxas

  if (Object.keys(patch).length === 0 && !credenciaisPlain) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nenhum campo para atualizar.',
    })
  }

  const admin = serverSupabaseServiceRole<any>(event)

  if (credenciaisPlain) {
    const passphrase = getAgenteSenhaMestraPassphrase(event)
    if (!passphrase) {
      throw createError({
        statusCode: 500,
        statusMessage:
          'NUXT_AGENTE_SENHA_MESTRA_ENCRIPTOGRAFIA_API_KEY não configurada no servidor.',
      })
    }
    await setCanalCredenciaisPagarmeEncrypted(admin, {
      canalId,
      workspaceId,
      credenciaisPlain,
      passphrase,
    })
  }

  if (Object.keys(patch).length > 0) {
    const { error: upErr } = await admin
      .from('canais')
      .update(patch)
      .eq('id', canalId)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .is('deleted_by', null)

    if (upErr) {
      throw createError({ statusCode: 500, statusMessage: upErr.message })
    }
  }

  const { data, error } = await admin
    .from('canais')
    .select(SELECT)
    .eq('id', canalId)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .is('deleted_by', null)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Canal não encontrado.' })
  }

  return mapCanalPagamentoRow(data as Record<string, unknown>, canalId, workspaceId)
})
