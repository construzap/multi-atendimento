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
 * - Salva: user_id do auth em `workspace`
 * - Insere em `atendentes`: mesmo usuário como admin e atendente do workspace
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

  // Cria funil padrão do workspace + colunas padrão
  const workspaceId =
    data && typeof data === 'object' && 'id' in data && typeof (data as any).id === 'number'
      ? (data as any).id
      : null

  if (workspaceId != null) {
    const { error: atendenteErr } = await admin.from('atendentes').insert({
      workspace_id: workspaceId,
      admin_user_id: userId,
      atendente_user_id: userId,
    })

    if (atendenteErr) {
      throw createError({ statusCode: 500, statusMessage: atendenteErr.message })
    }

    const { data: funilRow, error: funilErr } = await admin
      .from('funil_workspace')
      .upsert(
        {
          workspace_id: workspaceId,
          nome: 'Funil padrao',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id' },
      )
      .select('id')
      .single()

    if (funilErr) {
      throw createError({ statusCode: 500, statusMessage: funilErr.message })
    }

    const funilId =
      funilRow && typeof funilRow === 'object' && 'id' in funilRow && typeof (funilRow as any).id === 'number'
        ? (funilRow as any).id
        : null

    if (funilId != null) {
      const nowIso = new Date().toISOString()
      const cols = [
        { funil_id: funilId, nome: 'Em atendimento com I.A', cor: '#38BDF8', ordem: 1 },
        { funil_id: funilId, nome: 'Precisa de Atendimento', cor: '#F59E0B', ordem: 2 },
        { funil_id: funilId, nome: 'Prioridade', cor: '#F43F5E', ordem: 3 },
        { funil_id: funilId, nome: 'Venda', cor: '#10B981', ordem: 4 },
      ].map((c) => ({ ...c, updated_at: nowIso }))

      const { error: colsErr } = await admin.from('funil_workspace_colunas').insert(cols)
      if (colsErr) {
        throw createError({ statusCode: 500, statusMessage: colsErr.message })
      }
    }
  }

  return data as Workspace
})

