import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type {
  AdminAtualizarPerfilBody,
  AdminGerenciarAssinaturasResponse,
} from '#shared/types/adminGerenciarAssinaturas'
import { checkAdmin } from '../../../utils/checkAdmin'
import {
  fetchPerfilConsolidadoPorUserId,
  parseDataExpiracao,
  parseEmail,
  parseInteiroNaoNegativo,
  parseOptionalText,
  parseUserId,
} from '../../../utils/adminGerenciarAssinaturas'
import { getAuthUserId } from '../../../utils/getAuthUserId'

/**
 * POST /api/admin/gerenciarassinaturas
 * Atualiza campos editáveis em `public.profiles` e retorna o perfil consolidado.
 */
export default defineEventHandler(async (event): Promise<AdminGerenciarAssinaturasResponse> => {
  assertMethod(event, 'POST')

  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const authUserId = getAuthUserId(authData.user)
  if (!authUserId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  await checkAdmin(event, authUserId)

  const body = await readBody<AdminAtualizarPerfilBody>(event)
  const userId = parseUserId(body?.user_id)
  const email = parseEmail(body?.email)
  const fullName = parseOptionalText(body?.full_name)
  const dataExpiracao = parseDataExpiracao(body?.data_expiracao)
  const whatsapp = parseOptionalText(body?.whatsapp)
  const customer = parseOptionalText(body?.customer)
  const subscriptionId = parseOptionalText(body?.subscription_id)
  const canais = parseInteiroNaoNegativo(body?.canais, 'canais')
  const limiteIas = parseInteiroNaoNegativo(body?.limite_ias, 'limite_ias')

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: perfilExistente, error: perfilErr } = await admin
    .from('profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (perfilErr) {
    throw createError({ statusCode: 500, statusMessage: perfilErr.message })
  }

  if (!perfilExistente) {
    throw createError({ statusCode: 404, statusMessage: 'Perfil não encontrado' })
  }

  const { error: updateErr } = await admin
    .from('profiles')
    .update({
      email,
      full_name: fullName,
      data_expiracao: dataExpiracao,
      whatsapp,
      customer,
      subscription_id: subscriptionId,
      canais,
      limite_ias: limiteIas,
    })
    .eq('user_id', userId)

  if (updateErr) {
    throw createError({ statusCode: 500, statusMessage: updateErr.message })
  }

  const perfil = await fetchPerfilConsolidadoPorUserId(event, userId)
  return { perfil }
})
