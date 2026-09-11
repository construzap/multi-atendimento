import { serverSupabaseServiceRole } from '#supabase/server'
import { createError } from 'h3'
import type { H3Event } from 'h3'
import type { StatusLimiteTokens } from '#shared/types/profile'

/** Retorno enxuto da view `vw_perfil_consolidado` (limite de tokens). */
export type CheckLimiteTokensResult = {
  status_limite_tokens: StatusLimiteTokens
  total_tokens_usados: number
  limite_mensal_token: number | null
}

const STATUS_LIMITE_TOKENS_VALIDOS = new Set<string>([
  'dentro do limite',
  'limite atingido',
  'nao tem canal criado',
])

/**
 * Normaliza o valor bruto de `status_limite_tokens` da view.
 * @throws 500 se o valor for desconhecido.
 */
export function parseStatusLimiteTokens(raw: unknown): StatusLimiteTokens {
  const value = String(raw ?? '').trim().toLowerCase()
  if (STATUS_LIMITE_TOKENS_VALIDOS.has(value)) {
    return value as StatusLimiteTokens
  }

  throw createError({
    statusCode: 500,
    statusMessage: `status_limite_tokens inválido na visão consolidada: ${String(raw ?? '')}`,
  })
}

export function isDentroDoLimite(status: StatusLimiteTokens | string): boolean {
  return String(status).trim().toLowerCase() === 'dentro do limite'
}

export function isLimiteAtingido(status: StatusLimiteTokens | string): boolean {
  return String(status).trim().toLowerCase() === 'limite atingido'
}

export function naoTemCanalCriado(status: StatusLimiteTokens | string): boolean {
  return String(status).trim().toLowerCase() === 'nao tem canal criado'
}

export const MSG_LIMITE_TOKENS_ATINGIDO =
  'Limite de tokens atingido. Entre em contato com o suporte.'

/**
 * Permite uso quando status é `dentro do limite` ou `nao tem canal criado`.
 * @throws 403 — `limite atingido`
 */
export async function assertPodeUsarTokens(
  event: H3Event,
  userId: string,
): Promise<CheckLimiteTokensResult> {
  const result = await checkLimiteTokens(event, userId)
  if (isLimiteAtingido(result.status_limite_tokens)) {
    throw createError({
      statusCode: 403,
      statusMessage: MSG_LIMITE_TOKENS_ATINGIDO,
    })
  }
  return result
}

/**
 * Consulta `vw_perfil_consolidado` pelo `user_id` e retorna o status do limite mensal de tokens.
 *
 * Valores possíveis de `status_limite_tokens`:
 * - `dentro do limite`
 * - `limite atingido`
 * - `nao tem canal criado`
 *
 * @param userId UUID do dono do perfil (`profiles.user_id`).
 */
export async function checkLimiteTokens(
  event: H3Event,
  userId: string,
): Promise<CheckLimiteTokensResult> {
  const id = String(userId ?? '').trim()
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'user_id inválido' })
  }

  const admin = serverSupabaseServiceRole<any>(event)

  const { data, error } = await admin
    .from('vw_perfil_consolidado')
    .select('status_limite_tokens, total_tokens_usados, limite_mensal_token')
    .eq('user_id', id)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Perfil não encontrado na visão consolidada.',
    })
  }

  const totalRaw = (data as { total_tokens_usados?: unknown }).total_tokens_usados
  const total =
    totalRaw == null || totalRaw === ''
      ? 0
      : typeof totalRaw === 'number'
        ? totalRaw
        : Number(String(totalRaw))

  const limiteRaw = (data as { limite_mensal_token?: unknown }).limite_mensal_token
  const limite =
    limiteRaw == null || limiteRaw === ''
      ? null
      : typeof limiteRaw === 'number'
        ? limiteRaw
        : Number(String(limiteRaw))

  return {
    status_limite_tokens: parseStatusLimiteTokens(
      (data as { status_limite_tokens?: unknown }).status_limite_tokens,
    ),
    total_tokens_usados: Number.isFinite(total) ? total : 0,
    limite_mensal_token: limite != null && Number.isFinite(limite) ? limite : null,
  }
}
