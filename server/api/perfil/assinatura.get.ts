import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError } from 'h3'
import type { PerfilAssinatura, StatusAssinatura } from '#shared/types/profile'
import { getAuthUserId } from '../../utils/getAuthUserId'

/** Ex.: `2026-04-29 00:11:55.618835+00` (timestamptz legível, alinhado ao Postgres). */
function formatDataExpiracao(raw: string | null): string | null {
  if (raw == null || raw === '') return null
  let s = raw.trim().replace('T', ' ')
  s = s.replace(/\+00:00(?::00)?$/, '+00')
  if (s.endsWith('Z')) s = s.slice(0, -1) + '+00'
  return s
}

/**
 * GET /api/perfil/assinatura
 * Retorna status de assinatura e limites de canais a partir de `public.vw_perfil_consolidado`.
 */
export default defineEventHandler(async (event): Promise<PerfilAssinatura> => {
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

  const admin = serverSupabaseServiceRole<any>(event)
  const { data, error } = await admin
    .from('vw_perfil_consolidado')
    .select('data_expiracao, canais, canais_criados, status_assinatura')
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
      statusMessage: 'Perfil não encontrado'
    })
  }

  const canais =
    data.canais === null || data.canais === undefined ? null : Number(data.canais)
  const canais_criados =
    data.canais_criados === null || data.canais_criados === undefined
      ? 0
      : Number(data.canais_criados)

  const statusRaw = data.status_assinatura as string | null | undefined

  return {
    data_expiracao: formatDataExpiracao(data.data_expiracao as string | null),
    canais: Number.isFinite(canais as number) ? canais : null,
    canais_criados: Number.isFinite(canais_criados) ? canais_criados : 0,
    status_assinatura:
      statusRaw === null || statusRaw === undefined || statusRaw === ''
        ? null
        : (statusRaw as StatusAssinatura)
  }
})
