import { createError } from 'h3'
import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { getAgenteSenhaMestraPassphrase } from './getAgenteSenhaMestraPassphrase'

export type CanalAgenteCredenciais = {
  api_key: string
  model_name: string | null
  /** Base URL ou endpoint completo de chat/completions (OpenAI-compatible). */
  url: string | null
}

type RpcPayload = {
  model_name?: string | null
  url?: string | null
  api_key?: string | null
}

/**
 * Carrega model_name, url e api_key (descriptografada via pgp_sym_decrypt)
 * da tabela `canais` para o agent loop.
 */
export async function loadCanalAgenteCredenciais(
  event: H3Event,
  params: { workspace_id: number; canal_id: number },
): Promise<CanalAgenteCredenciais> {
  const passphrase = getAgenteSenhaMestraPassphrase(event)
  if (!passphrase) {
    throw createError({
      statusCode: 500,
      statusMessage:
        'NUXT_AGENTE_SENHA_MESTRA_ENCRIPTOGRAFIA_API_KEY não configurada no servidor.',
    })
  }

  const admin = serverSupabaseServiceRole<any>(event)
  const { data, error } = await admin.rpc('agente_canal_openai_credentials', {
    p_canal_id: params.canal_id,
    p_workspace_id: params.workspace_id,
    p_passphrase: passphrase,
  })

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Falha ao carregar credenciais do canal: ${error.message}`,
    })
  }

  if (data == null) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Canal não encontrado para este workspace.',
    })
  }

  const payload = (typeof data === 'object' ? data : null) as RpcPayload | null
  const apiKey = typeof payload?.api_key === 'string' ? payload.api_key.trim() : ''
  if (!apiKey) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'Canal sem api_key_encrypted configurada (ou descriptografia vazia).',
    })
  }

  const modelName =
    typeof payload?.model_name === 'string' && payload.model_name.trim()
      ? payload.model_name.trim()
      : null
  const url =
    typeof payload?.url === 'string' && payload.url.trim()
      ? payload.url.trim()
      : null

  return {
    api_key: apiKey,
    model_name: modelName,
    url,
  }
}

/** Normaliza url do canal para o endpoint de chat/completions. */
export function resolveOpenAiChatCompletionsUrl(url: string | null | undefined): string {
  const fallback = 'https://api.openai.com/v1/chat/completions'
  const raw = typeof url === 'string' ? url.trim() : ''
  if (!raw) return fallback

  const cleaned = raw.replace(/\/+$/, '')
  if (/\/chat\/completions$/i.test(cleaned)) return cleaned
  if (/\/v1$/i.test(cleaned)) return `${cleaned}/chat/completions`
  return `${cleaned}/chat/completions`
}
