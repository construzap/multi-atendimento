import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, readBody } from 'h3'

type UpdateWorkspaceBody = {
  nome?: string
  descricao?: string | null
}

/**
 * PATCH /api/workspace/:id
 * Edita `nome` e `descricao` do workspace, filtrando por `id` e `user_id` do usuário logado.
 *
 * Observação: usa service role (tabela com RLS).
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

  const userId = authData.user.id
  const idParam = event.context.params?.id
  const workspaceId = Number(idParam)

  if (!Number.isFinite(workspaceId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID do workspace inválido.'
    })
  }

  const body = (await readBody<UpdateWorkspaceBody>(event)) ?? {}

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
    .update({
      nome,
      descricao: descricao?.trim() || null
    })
    .eq('id', workspaceId)
    .eq('user_id', userId)
    .select('id, nome, descricao, created_at')
    .single()

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message
    })
  }

  return data
})

