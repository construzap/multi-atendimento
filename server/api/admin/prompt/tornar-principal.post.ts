import { serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { AdminPromptTornarPrincipalBody, PromptWorkspaceComPrincipal } from '#shared/types/adminPrompt'
import { PROMPT_WORKSPACE_TIPO_DEFAULT } from '#shared/types/adminPrompt'
import {
  assertAdminWorkspaceAtivo,
  assertPromptDoWorkspace,
  parsePromptId,
  parseWorkspaceId,
  requireAdminUser,
} from '../../../utils/adminPrompt'

/**
 * POST /api/admin/prompt/tornar-principal
 * Body: `{ workspace_id, id }`
 * Atualiza `workspace.prompt_principal` com o id do prompt (sem alterar `tipo`).
 */
export default defineEventHandler(async (event): Promise<PromptWorkspaceComPrincipal> => {
  assertMethod(event, 'POST')

  await requireAdminUser(event)

  const body = await readBody<AdminPromptTornarPrincipalBody>(event)
  const workspaceId = parseWorkspaceId(body?.workspace_id)
  const promptId = parsePromptId(body?.id)

  await assertAdminWorkspaceAtivo(event, workspaceId)
  await assertPromptDoWorkspace(event, promptId, workspaceId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { error: wsErr } = await admin
    .from('workspace')
    .update({ prompt_principal: promptId })
    .eq('id', workspaceId)

  if (wsErr) {
    throw createError({ statusCode: 500, statusMessage: wsErr.message })
  }

  const { data, error } = await admin
    .from('prompt_workspace')
    .select('id, workspace_id, nome, tipo, prompt, created_at, updated_at')
    .eq('id', promptId)
    .eq('workspace_id', workspaceId)
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const id = typeof data.id === 'number' ? data.id : Number(data.id)
  const wsId = typeof data.workspace_id === 'number' ? data.workspace_id : Number(data.workspace_id)

  return {
    id: Number.isFinite(id) ? id : 0,
    workspace_id: Number.isFinite(wsId) ? wsId : 0,
    nome: String(data.nome ?? '').trim(),
    tipo: String(data.tipo ?? PROMPT_WORKSPACE_TIPO_DEFAULT).trim(),
    prompt: String(data.prompt ?? ''),
    created_at: String(data.created_at ?? ''),
    updated_at: String(data.updated_at ?? ''),
    principal: true,
  }
})
