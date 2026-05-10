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
 * Verifica a assinatura do **admin** do workspace informado.
 *
 * Fluxo:
 * 1. Obtém o userId do usuário logado.
 * 2. Busca em `atendentes` o `admin_user_id` associado a `workspace_id` + `atendente_user_id`.
 * 3. Consulta `vw_perfil_consolidado` com o `admin_user_id` para retornar status e limites.
 *
 * @param workspaceId Id do workspace (já validado pelo caller).
 */
export async function checkSubscription(
  event: H3Event,
  workspaceId: number,
): Promise<CheckSubscriptionResult> {
  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: atendRow, error: atendErr } = await admin
    .from('atendentes')
    .select('admin_user_id')
    .eq('workspace_id', workspaceId)
    .eq('atendente_user_id', userId)
    .maybeSingle()

  if (atendErr) {
    throw createError({ statusCode: 500, statusMessage: atendErr.message })
  }

  if (!atendRow) {
    throw createError({
      statusCode: 403,
      statusMessage:
        'Você não tem acesso a este workspace. Peça ao administrador para adicioná-lo como atendente.',
    })
  }

  const rawAdmin = (atendRow as { admin_user_id?: unknown }).admin_user_id
  const adminUserId =
    typeof rawAdmin === 'string' ? rawAdmin : rawAdmin != null ? String(rawAdmin) : ''

  if (!adminUserId) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Registro de atendente sem administrador associado.',
    })
  }

  const { data, error } = await admin
    .from('vw_perfil_consolidado')
    .select('status_assinatura, canais, canais_criados')
    .eq('user_id', adminUserId)
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

  return {
    status_assinatura:
      typeof data.status_assinatura === 'string'
        ? data.status_assinatura
        : String(data.status_assinatura ?? ''),
    canais: data.canais != null ? Number(data.canais) : null,
    canais_criados: data.canais_criados != null ? Number(data.canais_criados) : null,
  }
}
