import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError } from 'h3'
import type { H3Event } from 'h3'
import { getAuthUserId } from './getAuthUserId'

/** Retorno enxuto da view `vw_perfil_consolidado` (apenas campos de assinatura / limites de canal). */
export type CheckSubscriptionResult = {
  status_assinatura: string
  canais: number | null
  canais_criados: number | null
}

/**
 * Busca na view `public.vw_perfil_consolidado` os dados de assinatura do usuário logado
 * (via cookie/sessão). Usa service role na leitura, como nos demais endpoints.
 *
 * Retorna somente: `status_assinatura`, `canais`, `canais_criados`.
 */
export async function checkSubscription(event: H3Event): Promise<CheckSubscriptionResult> {
  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Não autenticado'
    })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Não autenticado'
    })
  }

  // Tipos do DB ainda não configurados (Database = unknown), então usamos any aqui.
  const admin = serverSupabaseServiceRole<any>(event)
  const { data, error } = await admin
    .from('vw_perfil_consolidado')
    .select('status_assinatura, canais, canais_criados')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message
    })
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Perfil não encontrado na visão consolidada.'
    })
  }

  return {
    status_assinatura:
      typeof data.status_assinatura === 'string' ? data.status_assinatura : String(data.status_assinatura ?? ''),
    canais: data.canais != null ? Number(data.canais) : null,
    canais_criados: data.canais_criados != null ? Number(data.canais_criados) : null
  }
}
