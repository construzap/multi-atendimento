import { serverSupabaseServiceRole } from '#supabase/server'
import { createError } from 'h3'
import type { H3Event } from 'h3'
import type { AdminPerfilIaLimites } from '#shared/types/adminIa'

export const MSG_LIMITE_IA_ATINGIDO =
  'O limite de I.A do plano foi atingido. Faça upgrade do plano para ter mais I.A.s ou desative a I.A em outro workspace.'

export type CheckIAResult = {
  limite_ias: number
  ias_atreladas: number
}

/**
 * Obtém o `user_id` dono do workspace (criador).
 */
export async function getWorkspaceOwnerUserId(
  event: H3Event,
  workspaceId: number,
): Promise<string> {
  const admin = serverSupabaseServiceRole<any>(event)

  const { data, error } = await admin
    .from('workspace')
    .select('user_id')
    .eq('id', workspaceId)
    .is('deleted_at', null)
    .is('deleted_by', null)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const userId = (data as { user_id?: unknown } | null)?.user_id
  const ownerUserId = typeof userId === 'string' ? userId : userId != null ? String(userId) : ''

  if (!ownerUserId) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Workspace não encontrado ou sem dono associado.',
    })
  }

  return ownerUserId
}

/**
 * Busca limites de I.A em `vw_perfil_consolidado` para o dono do workspace.
 */
export async function fetchPerfilIaLimites(
  event: H3Event,
  workspaceOwnerUserId: string,
): Promise<AdminPerfilIaLimites> {
  const admin = serverSupabaseServiceRole<any>(event)

  const { data, error } = await admin
    .from('vw_perfil_consolidado')
    .select('user_id, limite_ias, ias_atreladas')
    .eq('user_id', workspaceOwnerUserId)
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

  const row = data as Record<string, unknown>
  const limiteRaw = row.limite_ias
  const atreladasRaw = row.ias_atreladas

  const limite =
    limiteRaw === null || limiteRaw === undefined ? null : Number(limiteRaw)
  const iasAtreladas =
    atreladasRaw === null || atreladasRaw === undefined ? 0 : Number(atreladasRaw)

  return {
    user_id: workspaceOwnerUserId,
    limite_ias: limite != null && Number.isFinite(limite) ? limite : null,
    ias_atreladas: Number.isFinite(iasAtreladas) ? iasAtreladas : 0,
  }
}

/**
 * Verifica em `vw_perfil_consolidado` se o dono do workspace ainda pode ativar mais I.A.
 * Compara `ias_atreladas` com `limite_ias`.
 *
 * @throws 403 — limite atingido ou não configurado
 * @throws 404 — perfil não encontrado na view
 */
export async function checkIA(event: H3Event, workspaceOwnerUserId: string): Promise<CheckIAResult> {
  const perfil = await fetchPerfilIaLimites(event, workspaceOwnerUserId)

  if (perfil.limite_ias == null || !Number.isFinite(perfil.limite_ias)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Limite de I.A não está configurado para o perfil deste workspace.',
    })
  }

  if (perfil.ias_atreladas >= perfil.limite_ias) {
    throw createError({
      statusCode: 403,
      statusMessage: MSG_LIMITE_IA_ATINGIDO,
    })
  }

  return {
    limite_ias: perfil.limite_ias,
    ias_atreladas: perfil.ias_atreladas,
  }
}
