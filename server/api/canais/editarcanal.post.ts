import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, readBody } from 'h3'
import type { Canal } from '#shared/types/canal'
import { checkChannel } from '../../utils/checkChannel'
import { getAuthUserId } from '../../utils/getAuthUserId'

type EditarCanalBody = {
  nome?: string
  descricao?: string | null
  workspace_id?: number | string
  id_canal?: number | string
}

/**
 * POST /api/canais/editarcanal
 * Atualiza nome e descrição do canal.
 *
 * - Mesmas validações de corpo que `criarcanal` (nome obrigatório, descrição opcional).
 * - Sem verificação de assinatura.
 * - Posse do canal: `checkChannel` (user_id + id do canal).
 * - Atualização restrita ao `workspace_id` informado (filtro no UPDATE; 404 se não bater).
 */
export default defineEventHandler(async (event) => {
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

  const body = (await readBody<EditarCanalBody>(event)) ?? {}

  const nome = typeof body.nome === 'string' ? body.nome.trim() : ''
  const descricao = body.descricao === undefined ? null : body.descricao

  if (!nome) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe o nome.'
    })
  }

  if (descricao !== null && typeof descricao !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Descrição inválida.'
    })
  }

  const rawWs = body.workspace_id
  if (rawWs === undefined || rawWs === null || rawWs === '') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe o workspace_id.'
    })
  }

  const workspaceId =
    typeof rawWs === 'number' ? rawWs : Number.parseInt(String(rawWs), 10)

  if (!Number.isFinite(workspaceId) || !Number.isInteger(workspaceId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'workspace_id inválido.'
    })
  }

  const rawCanal = body.id_canal
  if (rawCanal === undefined || rawCanal === null || rawCanal === '') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe o id_canal.'
    })
  }

  const canalId =
    typeof rawCanal === 'number' ? rawCanal : Number.parseInt(String(rawCanal), 10)

  if (!Number.isFinite(canalId) || !Number.isInteger(canalId) || canalId < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'id_canal inválido.'
    })
  }

  const owns = await checkChannel(event, canalId, userId)
  if (!owns) {
    throw createError({
      statusCode: 403,
      statusMessage:
        'Canal não encontrado ou você não tem permissão para editá-lo.'
    })
  }

  const admin = serverSupabaseServiceRole<any>(event)

  const { data, error } = await admin
    .from('canais')
    .update({
      nome,
      descricao: descricao?.trim() || null
    })
    .eq('id', canalId)
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .is('deleted_by', null)
    .select('id, nome, descricao, provedor, created_at')
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
      statusMessage: 'Canal não encontrado neste workspace ou foi removido.'
    })
  }

  return data as Canal
})
