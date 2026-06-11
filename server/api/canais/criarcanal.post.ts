import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, readBody } from 'h3'
import { checkSubscription } from '../../utils/checkSubscription'
import { getAuthUserId } from '../../utils/getAuthUserId'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { initUazapiInstance } from '../../utils/uazapi'

type CreateCanalBody = {
  nome?: string
  descricao?: string | null
  workspace_id?: number | string
}

/**
 * POST /api/canais/criarcanal
 * Cria um canal no workspace indicado.
 *
 * - Recebe: nome, descricao, workspace_id
 * - Salva: user_id do auth (getUser), igual ao fluxo de /api/perfil/me
 * - Assinatura (`vw_perfil_consolidado` via `checkSubscription`): bloqueia se status
 *   `pendente` ou `cancelado`; caso contrário exige `canais_criados < canais` (limite do plano).
 *   No trial, ao estourar o limite, mensagem orientando upgrade.
 * - Garante posse do workspace: linha em `workspace` com mesmo `id`, `user_id` = usuário
 *   do JWT e sem soft delete (`deleted_by` / `deleted_at` nulos). Caso contrário, 403.
 * - Escrita via service role (tabela com RLS)
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

  const body = (await readBody<CreateCanalBody>(event)) ?? {}

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

  const sub = await checkSubscription(event, workspaceId)
  const statusAssinatura = sub.status_assinatura.trim().toLowerCase()

  if (statusAssinatura === 'pendente' || statusAssinatura === 'cancelado') {
    throw createError({
      statusCode: 403,
      statusMessage:
        'Sua assinatura não permite criar canais neste momento. Regularize ou renove o plano para continuar.'
    })
  }

  const limiteCanais = sub.canais
  const criados = sub.canais_criados ?? 0

  if (limiteCanais == null || !Number.isFinite(Number(limiteCanais))) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Limite de canais não está configurado para seu perfil.'
    })
  }

  const maxCanais = Number(limiteCanais)
  if (criados >= maxCanais) {
    if (statusAssinatura === 'trial') {
      throw createError({
        statusCode: 403,
        statusMessage:
          'Você atingiu o limite de canais do período de trial. Faça upgrade do plano para criar mais canais.'
      })
    }
    throw createError({
      statusCode: 403,
      statusMessage: 'Limite de canais do seu plano atingido.'
    })
  }

  // Tipos do DB ainda não configurados (Database = unknown), então usamos any aqui.
  const admin = serverSupabaseServiceRole<any>(event)

  await checkWorkspace(event, workspaceId, userId)

  const { data, error } = await admin
    .from('canais')
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      nome,
      descricao: descricao?.trim() || null
    })
    .select('id, workspace_id, user_id, nome, descricao, created_at')
    .single()

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message
    })
  }

  // Cria instância na Uazapi e salva `token`/`servidor`.
  try {
    const instanceName = `${nome}-${workspaceId}-${data.id}`
    const { token, servidor } = await initUazapiInstance(instanceName)

    const { data: updated, error: upErr } = await admin
      .from('canais')
      .update({ token, servidor })
      .eq('id', data.id)
      .select('id, workspace_id, user_id, nome, descricao, created_at')
      .single()

    if (upErr) {
      throw createError({
        statusCode: 500,
        statusMessage: upErr.message
      })
    }

    return updated
  } catch (err) {
    // Rollback best-effort: não deixar canal criado sem instância.
    await admin.from('canais').delete().eq('id', data.id)
    throw err
  }
})
