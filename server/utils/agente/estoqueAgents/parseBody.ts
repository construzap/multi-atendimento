import { createError } from 'h3'
import type { H3Event } from 'h3'
import { assertAdminWorkspaceAtivo } from '../../adminPrompt'
import { loadCanalAgenteCredenciais } from '../loadCanalCredenciais'

export function parsePositiveInt(raw: unknown, label: string): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  return n
}

export function strOrNull(v: unknown): string | null {
  if (v === undefined || v === null) return null
  const s = typeof v === 'string' ? v.trim() : String(v).trim()
  return s.length ? s : null
}

export function strOrEmpty(v: unknown): string {
  return strOrNull(v) ?? ''
}

export function pickProdutos(body: Record<string, unknown>): string {
  return strOrEmpty(
    body.produtos ?? body.produtos_ ?? body['produtos '],
  )
}

/** System prompt obrigatório enviado pelo N8N no body (sem fallback embutido). */
export function requireSystemPrompt(body: Record<string, unknown>): string {
  const prompt = strOrEmpty(
    body.system_prompt ?? body.systemPrompt ?? body.systemMessage ?? body.system_message,
  )
  if (!prompt) {
    throw createError({
      statusCode: 400,
      statusMessage: 'system_prompt é obrigatório.',
    })
  }
  return prompt
}

export function parseWorkspaceIdFromEstoqueBody(body: Record<string, unknown>): number {
  const raw = body.workspace_id ?? body.empresa_id
  if (raw !== undefined && raw !== null && raw !== '') {
    return parsePositiveInt(raw, 'workspace_id')
  }
  const uuid = body.UUID ?? body.uuid
  if (uuid !== undefined && uuid !== null && uuid !== '' && /^\d+$/.test(String(uuid).trim())) {
    return parsePositiveInt(uuid, 'workspace_id')
  }
  throw createError({
    statusCode: 400,
    statusMessage: 'workspace_id é obrigatório (aceita também empresa_id).',
  })
}

export function parseCanalId(body: Record<string, unknown>): number {
  return parsePositiveInt(body.canal_id ?? body.id_canal, 'canal_id')
}

export function previewToolResult(text: string, max = 1500): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export function parseToolArgs(rawArgs: string): Record<string, unknown> {
  try {
    return rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {}
  } catch {
    return { _raw: rawArgs }
  }
}

export async function resolveEstoqueAgentOpenAi(
  event: H3Event,
  params: {
    workspace_id: number
    canal_id: number
    modelOverride: string | null
  },
): Promise<{
  model: string
  apiKey: string
  baseUrl: string | null
  maxToolRounds: number
}> {
  await assertAdminWorkspaceAtivo(event, params.workspace_id)

  const canalCredenciais = await loadCanalAgenteCredenciais(event, {
    workspace_id: params.workspace_id,
    canal_id: params.canal_id,
  })

  const config = useRuntimeConfig(event)
  const defaultModel = String(config.openaiAgentModel || 'gpt-4.1-mini-2025-04-14').trim()
  const maxRoundsDefault = Number.parseInt(String(config.agenteMaxToolRounds || '8'), 10)

  return {
    model: params.modelOverride || canalCredenciais.model_name || defaultModel,
    apiKey: canalCredenciais.api_key,
    baseUrl: canalCredenciais.url,
    maxToolRounds:
      Number.isFinite(maxRoundsDefault) && maxRoundsDefault > 0
        ? Math.min(maxRoundsDefault, 8)
        : 4,
  }
}

export function parseMaxToolRounds(
  raw: unknown,
  fallback: number,
): number {
  if (raw == null) return fallback
  const n = Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.min(n, 8)
}
