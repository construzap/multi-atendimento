import { serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { AdminPromptExcluirBody } from '#shared/types/adminPrompt'
import {
  assertAdminWorkspaceAtivo,
  assertPromptDoWorkspace,
  getPromptPrincipalId,
  parsePromptId,
  parseWorkspaceId,
  requireAdminUser,
} from '../../../utils/adminPrompt'

/**
 * POST /api/admin/prompt/excluir
 * Body: `{ workspace_id, id }`
 * Remove o prompt e limpa `workspace.prompt_principal` se for o principal.
 */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  assertMethod(event, 'POST')

  await requireAdminUser(event)

  const body = await readBody<AdminPromptExcluirBody>(event)
  const workspaceId = parseWorkspaceId(body?.workspace_id)
  const promptId = parsePromptId(body?.id)

  await assertAdminWorkspaceAtivo(event, workspaceId)
  await assertPromptDoWorkspace(event, promptId, workspaceId)

  const admin = serverSupabaseServiceRole<any>(event)
  const principalId = await getPromptPrincipalId(event, workspaceId)

  const { error: delErr } = await admin
    .from('prompt_workspace')
    .delete()
    .eq('id', promptId)
    .eq('workspace_id', workspaceId)

  if (delErr) {
    throw createError({ statusCode: 500, statusMessage: delErr.message })
  }

  if (principalId === promptId) {
    const { error: wsErr } = await admin
      .from('workspace')
      .update({ prompt_principal: null })
      .eq('id', workspaceId)

    if (wsErr) {
      throw createError({ statusCode: 500, statusMessage: wsErr.message })
    }
  }

  return { ok: true }
})
