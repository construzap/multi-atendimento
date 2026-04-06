import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, readBody } from 'h3'
import type { Workspace } from '#shared/types/workspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

type CreateWorkspaceBody = {
  nome?: string
  descricao?: string | null
}

/**
 * POST /api/workspaces
 * Cria um workspace para o usuário logado.
 *
 * - Recebe: nome, descricao
 * - Salva: user_id do auth
 * - Escrita via service role (tabela com RLS)
 */
export default defineEventHandler(async (event): Promise<Workspace> => {
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

  const body = (await readBody<CreateWorkspaceBody>(event)) ?? {}

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

  // Tipos do DB ainda não configurados (Database = unknown), então usamos any aqui.
  const admin = serverSupabaseServiceRole<any>(event)
  const { data, error } = await admin
    .from('workspace')
    .insert({
      nome,
      descricao: descricao?.trim() || null,
      user_id: userId
    })
    .select('id, nome, descricao, created_at')
    .single()

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message
    })
  }

  return data as Workspace
})

