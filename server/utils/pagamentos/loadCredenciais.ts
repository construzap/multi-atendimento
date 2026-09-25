import { createError } from 'h3'
import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { getAgenteSenhaMestraPassphrase } from '../agente/getAgenteSenhaMestraPassphrase'

export async function loadCanalCredenciaisPagamento(
  event: H3Event,
  params: { canalId: number; workspaceId: number },
): Promise<string> {
  const passphrase = getAgenteSenhaMestraPassphrase(event)
  if (!passphrase) {
    throw createError({
      statusCode: 500,
      statusMessage:
        'NUXT_AGENTE_SENHA_MESTRA_ENCRIPTOGRAFIA_API_KEY não configurada no servidor.',
    })
  }

  const admin = serverSupabaseServiceRole<any>(event)
  const { data, error } = await admin.rpc('agente_canal_credenciais_pagamento', {
    p_canal_id: params.canalId,
    p_workspace_id: params.workspaceId,
    p_passphrase: passphrase,
  })

  if (error) {
    const decryptHint = /Wrong key or corrupt data/i.test(error.message)
      ? ' Confira a senha mestra e regrave a credencial do canal.'
      : ''
    const ausente =
      error.message.includes('function') || error.message.includes('schema cache')
    throw createError({
      statusCode: 500,
      statusMessage: ausente
        ? 'Função agente_canal_credenciais_pagamento ausente. Rode server/sql/decrypt_canal_credenciais_pagamento.sql no Supabase.'
        : `Falha ao ler credenciais de pagamento: ${error.message}${decryptHint}`,
    })
  }

  const key = typeof data === 'string' ? data.trim() : ''
  if (!key) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Credencial de pagamento não cadastrada neste canal.',
    })
  }
  return key
}
